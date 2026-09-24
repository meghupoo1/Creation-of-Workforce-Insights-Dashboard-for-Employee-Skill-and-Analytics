from aws_cdk import (
    Stack,
    aws_s3 as s3,
    aws_redshiftserverless as redshift,
    aws_opensearchserverless as opensearch,
    aws_logs as logs,
    CfnOutput,
    RemovalPolicy
)
from constructs import Construct

class WorkforceAnalyticsStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # 1. Amazon S3 Data Lake
        self.data_lake_bucket = s3.Bucket(
            self, "WorkforceDataLakeBucket",
            versioned=True,
            encryption=s3.BucketEncryption.S3_MANAGED,
            removal_policy=RemovalPolicy.RETAIN,
            auto_delete_objects=False
        )
        CfnOutput(
            self,
            "WorkforceDataLakeBucketName",
            value=self.data_lake_bucket.bucket_name,
            description="Set S3_BUCKET_NAME to this value for the workforce backend.",
        )

        # 2. Amazon Redshift Serverless (Analytics Warehouse)
        self.redshift_namespace = redshift.CfnNamespace(
            self, "WorkforceRedshiftNamespace",
            namespace_name="workforce-analytics",
            db_name="workforce_dw"
        )
        self.redshift_workgroup = redshift.CfnWorkgroup(
            self, "WorkforceRedshiftWorkgroup",
            workgroup_name="workforce-workgroup",
            namespace_name=self.redshift_namespace.namespace_name,
            base_capacity=8
        )

        # 3. Amazon OpenSearch Serverless (Vector Search for AI HR Assistant)
        self.opensearch_collection = opensearch.CfnCollection(
            self, "WorkforceVectorSearchCollection",
            name="workforce-hr-vectors",
            type="VECTORSEARCH",
            description="Vector index for natural language HR policy Q&A and skill match."
        )

        # 4. Amazon CloudWatch Logs / AWS CloudTrail (Audit Log Group)
        self.audit_log_group = logs.LogGroup(
            self, "WorkforceAuditLogGroup",
            log_group_name="/aws/workforce/audit-events",
            retention=logs.RetentionDays.ONE_YEAR,
            removal_policy=RemovalPolicy.RETAIN
        )
