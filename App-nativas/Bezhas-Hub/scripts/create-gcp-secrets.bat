@echo off
set GCLOUD="C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
set PROJECT=totemic-bonus-479312-c6

echo Creating secrets...

%GCLOUD% secrets create STRIPE_WEBHOOK_SECRET --replication-policy="automatic" --project=%PROJECT% 2>nul
echo PLACEHOLDER | %GCLOUD% secrets versions add STRIPE_WEBHOOK_SECRET --data-file=- --project=%PROJECT% 2>nul
echo Created: STRIPE_WEBHOOK_SECRET

%GCLOUD% secrets create GOOGLE_CLIENT_ID --replication-policy="automatic" --project=%PROJECT% 2>nul
echo PLACEHOLDER | %GCLOUD% secrets versions add GOOGLE_CLIENT_ID --data-file=- --project=%PROJECT% 2>nul
echo Created: GOOGLE_CLIENT_ID

%GCLOUD% secrets create GOOGLE_CLIENT_SECRET --replication-policy="automatic" --project=%PROJECT% 2>nul
echo PLACEHOLDER | %GCLOUD% secrets versions add GOOGLE_CLIENT_SECRET --data-file=- --project=%PROJECT% 2>nul
echo Created: GOOGLE_CLIENT_SECRET

%GCLOUD% secrets create GITHUB_CLIENT_ID --replication-policy="automatic" --project=%PROJECT% 2>nul
echo PLACEHOLDER | %GCLOUD% secrets versions add GITHUB_CLIENT_ID --data-file=- --project=%PROJECT% 2>nul
echo Created: GITHUB_CLIENT_ID

%GCLOUD% secrets create GITHUB_CLIENT_SECRET --replication-policy="automatic" --project=%PROJECT% 2>nul
echo PLACEHOLDER | %GCLOUD% secrets versions add GITHUB_CLIENT_SECRET --data-file=- --project=%PROJECT% 2>nul
echo Created: GITHUB_CLIENT_SECRET

%GCLOUD% secrets create RELAYER_PRIVATE_KEY --replication-policy="automatic" --project=%PROJECT% 2>nul
echo PLACEHOLDER | %GCLOUD% secrets versions add RELAYER_PRIVATE_KEY --data-file=- --project=%PROJECT% 2>nul
echo Created: RELAYER_PRIVATE_KEY

%GCLOUD% secrets create POLYGON_RPC_URL --replication-policy="automatic" --project=%PROJECT% 2>nul
echo PLACEHOLDER | %GCLOUD% secrets versions add POLYGON_RPC_URL --data-file=- --project=%PROJECT% 2>nul
echo Created: POLYGON_RPC_URL

%GCLOUD% secrets create GEMINI_API_KEY --replication-policy="automatic" --project=%PROJECT% 2>nul
echo PLACEHOLDER | %GCLOUD% secrets versions add GEMINI_API_KEY --data-file=- --project=%PROJECT% 2>nul
echo Created: GEMINI_API_KEY

%GCLOUD% secrets create OPENAI_API_KEY --replication-policy="automatic" --project=%PROJECT% 2>nul
echo PLACEHOLDER | %GCLOUD% secrets versions add OPENAI_API_KEY --data-file=- --project=%PROJECT% 2>nul
echo Created: OPENAI_API_KEY

%GCLOUD% secrets create PINATA_API_KEY --replication-policy="automatic" --project=%PROJECT% 2>nul
echo PLACEHOLDER | %GCLOUD% secrets versions add PINATA_API_KEY --data-file=- --project=%PROJECT% 2>nul
echo Created: PINATA_API_KEY

%GCLOUD% secrets create PINATA_SECRET_KEY --replication-policy="automatic" --project=%PROJECT% 2>nul
echo PLACEHOLDER | %GCLOUD% secrets versions add PINATA_SECRET_KEY --data-file=- --project=%PROJECT% 2>nul
echo Created: PINATA_SECRET_KEY

echo.
echo Adding placeholder values to existing secrets...
echo PLACEHOLDER | %GCLOUD% secrets versions add MONGODB_URI --data-file=- --project=%PROJECT% 2>nul
echo PLACEHOLDER | %GCLOUD% secrets versions add REDIS_URL --data-file=- --project=%PROJECT% 2>nul
echo PLACEHOLDER | %GCLOUD% secrets versions add STRIPE_SECRET_KEY --data-file=- --project=%PROJECT% 2>nul

echo.
echo Done! Listing all secrets:
%GCLOUD% secrets list --project=%PROJECT%
