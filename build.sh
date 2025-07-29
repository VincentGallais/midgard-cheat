#!/bin/bash

# Login to the AWS account (if not already logged in)
SSO_ACCOUNT=$(aws sts get-caller-identity --query "Account" --profile "$1" | sed 's/^.//;s/.$//')
if [[ -n "$SSO_ACCOUNT" ]]; then
    echo "The session if still valid (will be reused)"
else
    echo "Log in to the AWS account corresponding to the profile $1"

    ERROR=$(aws sso login --profile "$1" 2>&1 >/dev/null)
    if [[ -n "$ERROR" ]]; then
        echo "Cannot log in to the AWS account corresponding to the profile $1"
        exit 1
    fi
    SSO_ACCOUNT=$(aws sts get-caller-identity --query "Account" --profile "$1" | sed 's/^.//;s/.$//')
fi

AWS_PROFILE=$(echo "$1" | awk -F"-sso" '{print $1}')
echo "Profile set to ${AWS_PROFILE} (#${SSO_ACCOUNT})"

# Login to the public ECR repository (Docker)
echo "Log in to the AWS ECR public repository"

aws ecr-public get-login-password --region us-east-1 --profile "${AWS_PROFILE}" | docker login --username AWS --password-stdin public.ecr.aws

# Build image
echo "Cheat-detection image build started"

docker build -t midgard/cheat-detection .

# Exit (SUCCESS)
exit 0
