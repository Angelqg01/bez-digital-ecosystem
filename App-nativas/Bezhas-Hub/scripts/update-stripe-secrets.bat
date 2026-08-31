@echo off
echo Updating Stripe Secrets in GCP Secret Manager...

echo "pk_live_PLACEHOLDER" > temp_pk.txt
echo Updating stripe-publishable-key...
call gcloud secrets versions add stripe-publishable-key --data-file=temp_pk.txt
del temp_pk.txt

echo "sk_live_PLACEHOLDER" > temp_sk.txt
echo Updating stripe-secret-key...
call gcloud secrets versions add stripe-secret-key --data-file=temp_sk.txt
del temp_sk.txt

echo "whsec_PLACEHOLDER" > temp_wh.txt
echo Updating stripe-webhook-secret...
call gcloud secrets versions add stripe-webhook-secret --data-file=temp_wh.txt
del temp_wh.txt

echo Secrets updated successfully.
exit /b 0
