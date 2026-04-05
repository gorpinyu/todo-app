import aws_cdk as cdk
from aws_cdk import (
    aws_ec2 as ec2,
    aws_rds as rds,
    aws_lambda as lambda_,
    aws_apigatewayv2 as apigwv2,
    aws_apigatewayv2_integrations as integrations,
    aws_s3 as s3,
    aws_s3_deployment as s3deploy,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_secretsmanager as secretsmanager,
    aws_iam as iam,
    Duration,
    RemovalPolicy,
    CfnOutput,
)
from constructs import Construct


class TodoStack(cdk.Stack):
    def __init__(self, scope: Construct, construct_id: str, stage: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        is_prod = stage == "prod"

        # ── VPC (no NAT — Lambda in public subnet, RDS in isolated) ──────────
        vpc = ec2.Vpc(
            self, "VpcResource",
            max_azs=2,
            nat_gateways=0,
            subnet_configuration=[
                ec2.SubnetConfiguration(name="Public", subnet_type=ec2.SubnetType.PUBLIC, cidr_mask=24),
                ec2.SubnetConfiguration(name="Isolated", subnet_type=ec2.SubnetType.PRIVATE_ISOLATED, cidr_mask=24),
            ],
        )

        # ── RDS PostgreSQL ────────────────────────────────────────────────────
        db_sg = ec2.SecurityGroup(self, "DbSgResource", vpc=vpc, description="RDS security group")
        db_sg.add_ingress_rule(ec2.Peer.any_ipv4(), ec2.Port.tcp(5432), "PostgreSQL SSL from Lambda")
        db_secret = rds.DatabaseSecret(self, "DbSecretResource", username="todo_admin")

        db = rds.DatabaseInstance(
            self, "DbResource",
            engine=rds.DatabaseInstanceEngine.postgres(version=rds.PostgresEngineVersion.VER_16),
            instance_type=ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_ISOLATED),
            security_groups=[db_sg],
            credentials=rds.Credentials.from_secret(db_secret),
            database_name="todo",
            multi_az=is_prod,
            deletion_protection=is_prod,
            removal_policy=RemovalPolicy.SNAPSHOT if is_prod else RemovalPolicy.DESTROY,
            backup_retention=Duration.days(7) if is_prod else Duration.days(1),
            publicly_accessible=True,
        )

        jwt_secret = secretsmanager.Secret.from_secret_complete_arn(
            self, "JwtSecretResource",
            "arn:aws:secretsmanager:us-east-1:296122127181:secret:todo-dev/jwt-secret-wHDHqa"
        )

        # ── Email sender Lambda (no VPC — reaches SES directly) ──────────────
        email_fn = lambda_.Function(
            self, "EmailFnResource",
            runtime=lambda_.Runtime.NODEJS_20_X,
            handler="index.handler",
            code=lambda_.Code.from_inline(
                'const{SESClient,SendEmailCommand}=require("@aws-sdk/client-ses");'
                'const ses=new SESClient({region:"us-east-1"});'
                'exports.handler=async(e)=>{'
                'await ses.send(new SendEmailCommand({'
                'Source:e.from,Destination:{ToAddresses:[e.to]},'
                'Message:{Subject:{Data:e.subject},Body:{Html:{Data:e.html},Text:{Data:e.text}}}'
                '}));};'
            ),
            timeout=Duration.seconds(30),
        )
        email_fn.add_to_role_policy(iam.PolicyStatement(
            actions=["ses:SendEmail", "ses:SendRawEmail"],
            resources=["*"],
        ))

        # ── Main backend Lambda (no VPC — connects to RDS via SSL, calls AWS APIs freely) ─
        backend_fn = lambda_.Function(
            self, "BackendFnResource",
            runtime=lambda_.Runtime.NODEJS_20_X,
            handler="server.handler",
            code=lambda_.Code.from_asset("../backend/dist"),
            environment={
                "DB_HOST": db.db_instance_endpoint_address,
                "DB_PORT": db.db_instance_endpoint_port,
                "DB_NAME": "todo",
                "DB_USER": "todo_admin",
                "DB_PASSWORD": db_secret.secret_value_from_json("password").unsafe_unwrap(),
                "JWT_SECRET": jwt_secret.secret_value.unsafe_unwrap(),
                "EMAIL_FUNCTION_NAME": email_fn.function_name,
                "SES_FROM_EMAIL": "kiroandrii@gmail.com",
                "APP_URL": "https://d1tvflu4vk8bmb.cloudfront.net",
                "NODE_ENV": stage,
            },
            timeout=Duration.seconds(30),
            memory_size=512,
        )
        email_fn.grant_invoke(backend_fn)

        # ── API Gateway HTTP API ──────────────────────────────────────────────
        api = apigwv2.HttpApi(
            self, "ApiResource",
            cors_preflight=apigwv2.CorsPreflightOptions(
                allow_origins=["*"],
                allow_methods=[apigwv2.CorsHttpMethod.ANY],
                allow_headers=["Content-Type"],
            ),
        )
        api.add_routes(
            path="/{proxy+}",
            methods=[apigwv2.HttpMethod.ANY],
            integration=integrations.HttpLambdaIntegration("BackendIntegration", backend_fn),
        )

        # ── S3 + CloudFront ───────────────────────────────────────────────────
        frontend_bucket = s3.Bucket(
            self, "FrontendBucketResource",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )
        oac = cloudfront.S3OriginAccessControl(self, "OacResource")
        distribution = cloudfront.Distribution(
            self, "CdnResource",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(
                    frontend_bucket, origin_access_control=oac
                ),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
            ),
            additional_behaviors={
                "/api/*": cloudfront.BehaviorOptions(
                    origin=origins.HttpOrigin(
                        f"{api.api_id}.execute-api.{self.region}.amazonaws.com"
                    ),
                    viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
                    cache_policy=cloudfront.CachePolicy.CACHING_DISABLED,
                    allowed_methods=cloudfront.AllowedMethods.ALLOW_ALL,
                    origin_request_policy=cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
                ),
            },
            default_root_object="index.html",
            error_responses=[
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=200,
                    response_page_path="/index.html",
                )
            ],
        )
        s3deploy.BucketDeployment(
            self, "FrontendDeployResource",
            sources=[s3deploy.Source.asset("../frontend/dist")],
            destination_bucket=frontend_bucket,
            distribution=distribution,
            distribution_paths=["/*"],
        )

        CfnOutput(self, "AppUrl", value=f"https://{distribution.distribution_domain_name}")
        CfnOutput(self, "ApiUrl", value=api.api_endpoint)
        CfnOutput(self, "DbSecretArn", value=db_secret.secret_arn)
