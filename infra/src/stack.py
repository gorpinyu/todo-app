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
    Duration,
    RemovalPolicy,
    CfnOutput,
)
from constructs import Construct


class TodoStack(cdk.Stack):
    def __init__(self, scope: Construct, construct_id: str, stage: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        is_prod = stage == "prod"

        # ── VPC (no NAT gateway — Lambda runs in public subnets) ──────────────
        vpc = ec2.Vpc(
            self, "VpcResource",
            max_azs=2,
            nat_gateways=0,
            subnet_configuration=[
                ec2.SubnetConfiguration(name="Public", subnet_type=ec2.SubnetType.PUBLIC, cidr_mask=24),
                ec2.SubnetConfiguration(name="Isolated", subnet_type=ec2.SubnetType.PRIVATE_ISOLATED, cidr_mask=24),
            ],
        )

        # ── RDS PostgreSQL (isolated subnet, not publicly accessible) ─────────
        db_sg = ec2.SecurityGroup(self, "DbSgResource", vpc=vpc, description="RDS security group")

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
            publicly_accessible=False,
        )

        # ── Lambda security group ─────────────────────────────────────────────
        lambda_sg = ec2.SecurityGroup(self, "LambdaSgResource", vpc=vpc, description="Lambda security group")
        db_sg.add_ingress_rule(lambda_sg, ec2.Port.tcp(5432), "Lambda to RDS")

        jwt_secret = secretsmanager.Secret.from_secret_complete_arn(
            self, "JwtSecretResource",
            "arn:aws:secretsmanager:us-east-1:296122127181:secret:todo-dev/jwt-secret-wHDHqa"
        )

        # ── Lambda (public subnet, no NAT needed) ─────────────────────────────
        backend_fn = lambda_.Function(
            self, "BackendFnResource",
            runtime=lambda_.Runtime.NODEJS_20_X,
            handler="server.handler",
            code=lambda_.Code.from_asset("../backend/dist"),
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PUBLIC),
            security_groups=[lambda_sg],
            allow_public_subnet=True,
            environment={
                "DB_HOST": db.db_instance_endpoint_address,
                "DB_PORT": db.db_instance_endpoint_port,
                "DB_NAME": "todo",
                "DB_USER": "todo_admin",
                "DB_PASSWORD": db_secret.secret_value_from_json("password").unsafe_unwrap(),
                "JWT_SECRET": jwt_secret.secret_value.unsafe_unwrap(),
                "NODE_ENV": stage,
            },
            timeout=Duration.seconds(30),
            memory_size=512,
        )

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

        # ── S3 (frontend static assets) ───────────────────────────────────────
        frontend_bucket = s3.Bucket(
            self, "FrontendBucketResource",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        # ── CloudFront ────────────────────────────────────────────────────────
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

        # ── Deploy frontend build to S3 ───────────────────────────────────────
        s3deploy.BucketDeployment(
            self, "FrontendDeployResource",
            sources=[s3deploy.Source.asset("../frontend/dist")],
            destination_bucket=frontend_bucket,
            distribution=distribution,
            distribution_paths=["/*"],
        )

        # ── Outputs ───────────────────────────────────────────────────────────
        CfnOutput(self, "AppUrl", value=f"https://{distribution.distribution_domain_name}")
        CfnOutput(self, "ApiUrl", value=api.api_endpoint)
        CfnOutput(self, "DbSecretArn", value=db_secret.secret_arn)
