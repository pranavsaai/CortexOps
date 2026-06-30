set -e

RESOURCE_GROUP="cortexops-rg"
LOCATION="eastus"
ACR_NAME="cortexopsacr"
POSTGRES_SERVER="cortexops-postgres"
REDIS_NAME="cortexops-redis"
CONTAINER_APP_ENV="cortexops-env"
CONTAINER_APP_NAME="cortexops-api"

echo "🚀 Setting up CortexOps on Azure..."

# 1. Resource Group
echo "Creating resource group..."
az group create --name $RESOURCE_GROUP --location $LOCATION

# 2. Azure Container Registry
echo "Creating Container Registry..."
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# 3. Azure Database for PostgreSQL
echo "Creating PostgreSQL..."
az postgres flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $POSTGRES_SERVER \
  --location $LOCATION \
  --admin-user cortexops \
  --admin-password "CortexOps@2026!" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 32 \
  --version 16

# create database
az postgres flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $POSTGRES_SERVER \
  --database-name cortexops

# 4. Azure Cache for Redis
echo "Creating Redis Cache..."
az redis create \
  --resource-group $RESOURCE_GROUP \
  --name $REDIS_NAME \
  --location $LOCATION \
  --sku Basic \
  --vm-size c0

# 5. Container Apps Environment
echo "Creating Container Apps Environment..."
az containerapp env create \
  --name $CONTAINER_APP_ENV \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# 6. Deploy Container App
echo "Deploying Container App..."
ACR_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value -o tsv)

POSTGRES_URL="postgresql://cortexops:CortexOps@2026!@${POSTGRES_SERVER}.postgres.database.azure.com/cortexops"
REDIS_URL=$(az redis show --name $REDIS_NAME --resource-group $RESOURCE_GROUP --query hostName -o tsv)

az containerapp create \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $CONTAINER_APP_ENV \
  --image $ACR_SERVER/cortexops:latest \
  --registry-server $ACR_SERVER \
  --registry-username $ACR_NAME \
  --registry-password $ACR_PASSWORD \
  --target-port 8000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --env-vars \
    DATABASE_URL="$POSTGRES_URL" \
    REDIS_URL="rediss://${REDIS_URL}:6380" \
    GROQ_API_KEY="$GROQ_API_KEY" \
    MASTER_API_KEY="cortexops-master-key-prod" \
    SECRET_KEY="cortexops-prod-secret-key-2026"

echo "CortexOps deployed on Azure!"
echo "URL: https://$(az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --query properties.configuration.ingress.fqdn -o tsv)"