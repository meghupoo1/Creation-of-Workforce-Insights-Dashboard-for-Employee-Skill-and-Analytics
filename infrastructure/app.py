#!/usr/bin/env python3
import os
import aws_cdk as cdk
from stacks.rds_stack import WorkforceRdsStack
from stacks.analytics_stack import WorkforceAnalyticsStack

app = cdk.App()

# Deploy RDS Stack (Primary Transactional DB)
WorkforceRdsStack(
    app, "WorkforceRdsStack"
)

# Deploy Analytics & AI Stack (S3 Data Lake, Redshift DW, OpenSearch Vector Search, CloudWatch Logs)
WorkforceAnalyticsStack(
    app, "WorkforceAnalyticsStack"
)

app.synth()
