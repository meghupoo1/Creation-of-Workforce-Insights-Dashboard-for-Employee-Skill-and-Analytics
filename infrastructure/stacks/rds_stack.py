from aws_cdk import (
    Stack,
    aws_ec2 as ec2,
    aws_rds as rds,
    RemovalPolicy,
    SecretValue
)
from constructs import Construct

class WorkforceRdsStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Create a VPC for the database
        self.vpc = ec2.Vpc(
            self, "WorkforceVpc",
            max_azs=2,
            nat_gateways=1
        )

        # Create PostgreSQL Database Instance
        self.db_instance = rds.DatabaseInstance(
            self, "WorkforceDatabase",
            engine=rds.DatabaseInstanceEngine.postgres(
                version=rds.PostgresEngineVersion.VER_15_4
            ),
            instance_type=ec2.InstanceType.of(
                ec2.InstanceClass.BURSTABLE3, 
                ec2.InstanceSize.MICRO
            ),
            vpc=self.vpc,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS
            ),
            allocated_storage=20,
            max_allocated_storage=100,
            database_name="workforce_db",
            credentials=rds.Credentials.from_generated_secret("postgres"), # Securely stored in AWS Secrets Manager
            removal_policy=RemovalPolicy.DESTROY, # Warning: use RETAIN in production to avoid data loss
            deletion_protection=False
        )
