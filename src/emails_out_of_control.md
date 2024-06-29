---
title: My Emails Are Out Of Control
keywords:
  - personal email
  - python email automation
  - analyze email offenders
date: 2024-06-25
description: My emails are out of control. In order to take some of it back, i decided to write some python scripts to help out.
image: /images/email-running.png
alt: An email running away from being cleaned up.
priority: 0.9
---

## Introduction

My inbox is FULL. Not in the sense of storage capacity but my mental capacity.  Email is here to stay and i have chose not to commit to a zero inbox game.  So this is my attempt to using some code to analyze and clean up existing messages.  Let's get some control back.

## Code

**TLDR;**  the `who_has_email_the_most` script loops through 11 times by 30 days in an inbox using an IMAP protocol.  Builds a "top FROM" emails then displays it.  The `mark_for_deletions` script handles removing a single from email address at a time.

<script src="https://gist.github.com/skittleson/2c6e7a436229f558c86f3c67cefb2ee3.js"></script>

### Data

Mostly newsletters, some transactional.  Having a time-to-live on some of these emails would make sense.  That's not a feature i'm aware of so lets just do some data deletion. EDIT: there is a feature called Sweep in Outlook.com that does this.

```json
[('news@e.eyebuydirect.com', 290),
 ('shipment-tracking@amazon.com', 218),
 ('friendupdates@facebookmail.com', 215),
 ('express@em.express.com', 211),
 ('Costco@digital.costco.com', 207),
 ('photos@onedrive.com', 195),
 ('noreply@redditmail.com', 179),
 ('order-update@amazon.com', 178),
 ('Shutterfly@em.shutterfly.com', 159),
 ('REDACTED01@REDACTED01.com', 157),
 ('ProFlowers@news.proflowers.com', 151),
 ('USPSInformeddelivery@email.informeddelivery.usps.com', 149),
 ('marketplace-messages@amazon.com', 122),
 ('microsoft.start@email2.microsoft.com', 114),
 ('redcross@theamericanredcross.org', 112),
 ('REDACTED02@REDACTED02', 106),
 ('newsmax@latest.newsmax.com', 101),
 ('noreply@email.amctheatres.com', 95),
 ('jobs-listings@linkedin.com', 95),
 ('reply@rs.email.nextdoor.com', 93)]
```


## Solutions

- Unsubscribe from the top offenders
- Using a script, delete the top offending emails.
- Created some rules to archive emails via the web portal.
- Run the script top offenders monthly to evaluate who is wasting my time the most

## Conclusion

A bit of house cleaning will keep some sanity in my inbox.  With the addition of automation, it should get better over time.

