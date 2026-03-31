import aws_cdk as cdk
from stack import TodoStack

app = cdk.App()

TodoStack(
    app,
    "todo-dev",
    env=cdk.Environment(
        account=app.node.try_get_context("account"),
        region=app.node.try_get_context("region") or "us-east-1",
    ),
    stage="dev",
)

app.synth()
