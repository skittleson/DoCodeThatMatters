---
title: Project Onboarding for New Engineers
keywords: 
    - engineer training
    - guideline
date: 2022-07-05
description: General template/guide on how to onboard an engineer to new project.
image: https://images.unsplash.com/photo-1536597297293-f5adf6145863?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxzZWFyY2h8NXx8c2hpcCUyMGJvYXJkaW5nfGVufDB8fDB8fA%3D%3D&auto=format&fit=crop&w=500&q=60
alt: Boarding a ship
priority: 0.9
---

Engineers come and go on projects.  Getting an individual up to speed takes time.  With some experiments and listening to retros, this seems to be a good start.  


## Ordered Guide

- Explain a high level view of architecture and provide relevant docs. 
- Provide the individual a task/ticket but only to implement the business logic. 
- Both work on main test cases definitions including a single happy path and possible exceptions.
- Leave all external dependencies as `throw new NotImplementedException();` to be done once after the business logic.  Using dependency injection and/or dependency provider pattern has worked for me.
- Have the individual do a pull request early to give feedback in an async matter from a senior engineer. No longer than 1 week seems appropriate.
- Provide pair programming / code swarming / office hours in a regular cadence.

 