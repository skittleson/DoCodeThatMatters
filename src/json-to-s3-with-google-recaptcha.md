---
title: Save JSON Objects to AWS S3 with Google Recaptcha
keywords: 
  - AWS S3
  - Google Recaptcha
  - s3
  - json form
date: 2019-10-19
description: Save JSON objects to AWS S3 using Google Recaptcha in a AWS Lambda function.
image: https://images.unsplash.com/photo-1508345228704-935cc84bf5e2?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=668&q=80
alt: Chain fence locked
priority: 0.9
---


This post will show you how to save messages from a public endpoint to your backend using AWS Lambda, AWS S3 and Google Recaptcha.

Wrote the GIST for myself but I had enough requests to share it in a blog post. Copy/paste what you want.

## Request from a frontend source

Add this to the frontend index.html (or anywhere a form will be sent from). Replace the `_reCAPTCHA_site_key` with a real one.

    <script src="https://www.google.com/recaptcha/api.js?render=_reCAPTCHA_site_key"></script>
    <script>
    grecaptcha.ready(function() {
        grecaptcha.execute('_reCAPTCHA_site_key_', {action: 'homepage'}).then(function(token) {
        ...
        });
    });
    </script>

Docs: <https://developers.google.com/recaptcha/docs/v3>

## Backend Setup

Start by creating an AWS Lambda function that has access to add items to S3. Using a node.js/javascript lambda function.

Environment Keys:

- GoogleRecapKey : Get this from <https://developers.google.com/recaptcha>
- MessageBucket : Create a bucket in AWS S3.
- SnsTopicArn : Create a SNS topic to receive emails or SMS to your phone.

<script src="https://gist.github.com/skittleson/908481d3b22425ae75657890246006db.js"></script>

### API Gateway Setup

- Create an AWS API Gateway API with a resource `form` with a method `POST`.
- Integration type `Lambda Function`
- Use Lambda Proxy integration: checked
- Select Lambda function
