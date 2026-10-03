import os
from aws_cdk import (
    Stack,
    Duration,
    aws_ec2 as ec2,
    aws_rds as rds,
    CfnOutput,
    RemovalPolicy,
)
from constructs import Construct

class WorkforceRdsStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        is_dev = os.getenv("ENVIRONMENT", "production").lower() in ["dev", "development"]

        # 1. Create VPC for RDS database isolation
        self.vpc = ec2.Vpc(
            self, "WorkforceVpc",
            max_azs=2,
            nat_gateways=1,
            subnet_configuration=[
                ec2.SubnetConfiguration(
                    name="PublicSubnet",
                    subnet_type=ec2.SubnetType.PUBLIC,
                    cidr_mask=24
                ),
                ec2.SubnetConfiguration(
                    name="PrivateSubnet",
                    subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidr_mask=24
                )
            ]
        )

        # 2. Database Security Group
        self.db_security_group = ec2.SecurityGroup(
            self, "WorkforceRdsSecurityGroup",
            vpc=self.vpc,
            description="Security group for Workforce Insights RDS PostgreSQL database",
            allow_all_outbound=True
        )
        self.db_security_group.add_ingress_rule(
            peer=ec2.Peer.ipv4(self.vpc.vpc_cidr_block),
            connection=ec2.Port.tcp(5432),
            description="Allow PostgreSQL inbound from VPC"
        )

        # 3. Create AWS RDS PostgreSQL Database Instance
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
            security_groups=[self.db_security_group],
            allocated_storage=20,
            max_allocated_storage=100,
            database_name="workforce_db",
            credentials=rds.Credentials.from_generated_secret("postgres"), # Securely stored in AWS Secrets Manager
            backup_retention=Duration.days(7),
            removal_policy=RemovalPolicy.DESTROY if is_dev else RemovalPolicy.RETAIN,
            deletion_protection=not is_dev
        )

        # 4. CloudFormation Outputs for backend database configuration
        CfnOutput(
            self, "RdsEndpointAddress",
            value=self.db_instance.db_instance_endpoint_address,
            description="AWS RDS PostgreSQL host endpoint address for DATABASE_URL"
        )
        CfnOutput(
            self, "RdsEndpointPort",
            value=self.db_instance.db_instance_endpoint_port,
            description="AWS RDS PostgreSQL port"
        )
        CfnOutput(
            self, "RdsDatabaseName",
            value="workforce_db",
            description="Workforce primary database name"
        )
        if self.db_instance.secret:
            CfnOutput(
                self, "RdsSecretArn",
                value=self.db_instance.secret.secret_arn,
                description="AWS Secrets Manager Secret ARN for database credentials"
            )
        CfnOutput(
            self, "RdsSecurityGroupId",
            value=self.db_security_group.security_group_id,
            description="Security Group ID for RDS Database Instance"
        )

