# Instructions

Substrate chain scrapers template. 
These application is standalone part of the bigger project https://hydradx.documento.cz/ that is based on 😻 [NestJS](https://nestjs.com/) and [Prisma](https://www.prisma.io/).

## Application Setup


### Overview

Application **cannot be build for now**. So you can just clone it into target machine and start from the terminal with ts-node (see below).

### 1. Install Dependencies

Install the dependencies for the application:

```bash
npm install
```

### 2. PostgreSQL with Docker

Setup a development PostgreSQL with Docker. Follow `.env` which sets the required environments for PostgreSQL such as `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB`. Update the variables as you wish and select a strong password.

Start the PostgreSQL database

```bash
docker-compose -f docker-compose.db.yml up -d
# or
npm run docker:db
```

### 3. Prisma Migrate

[Prisma Migrate](https://github.com/prisma/prisma2/tree/master/docs/prisma-migrate) is used to manage the schema and migration of the database. Prisma datasource requires an environment variable `DATABASE_URL` for the connection to the PostgreSQL database. It takes variables from [.env](./.env) file which is also used by Prisma Migrate and for seeding the database. You can use [.env.example](./.env.example) to start with.

Use Prisma Migrate in your [development environment](https://www.prisma.io/blog/prisma-migrate-preview-b5eno5g08d0b#evolving-the-schema-in-development) to

1. Creates `migration.sql` file
2. Updates Database Schema
3. Generates Prisma Client

```bash
npx prisma migrate dev
# or
npm run migrate:dev
```

If you like to customize your `migration.sql` file run the following command. After making your customizations run `npx prisma migrate dev` to apply it.

```bash
npx prisma migrate dev --create-only
# or
npm run migrate:dev:create
```

If you are happy with your database changes you want to deploy those changes to your [production database](https://www.prisma.io/blog/prisma-migrate-preview-b5eno5g08d0b#applying-migrations-in-production-and-other-environments). Use `prisma migrate deploy` to apply all pending migrations, can also be used in CI/CD pipelines as it works without prompts.

```bash
npx prisma migrate deploy
# or
npm run migrate:deploy
```
### 4. Seed the database data with this script

Execute the script with this command:

```bash
npm run seed
```

### 5. Start Substrate Scrapers

Scrapers (sometimes called grabbers) are just console applications. It is possible to run them directly in the development env or in the production. They can be also started as the main command in the docker container (just look at the  `docker-compose-yml`file).
To show basic help you can run these commands:

In development env
```bash
npx ts-node -r tsconfig-paths/register src/console-apps/grabbers.ts --help 
```
In the production env - !!! not working for now !!!

```bash
node ./dist/console-apps/grabbers.js --help
```

> **Block scrapers**: next section will describe the best way to get blocks, events and extrinsics synchronized as soon as possible.

- run grabbers script with `-g block` option followed by `-gd` (grabbers direction) option. The common use is to grab the first block with the options `-g block --gd exact -n 1` to get the block number 1 into the database. 
- If you scrape data from small chain you will be fine with these options `-g block -gd from-highest-to-new`
- But if you have to sync the big chain (Polkadot, Kusama) there is the way how to run grabbers in parallel. Just run as many grabbers as you are able to controll and check in separate shell terminal with the option: `-g block -gd range-from-to -n x y` where `x` is the higher range block number and the `y` is the lower block number. So for example you can run three grabbers like this 
```bash
npx ts-node -r tsconfig-paths/register src/console-apps/grabbers.js -g block -gd range-from-to -n 1000000 1
npx ts-node -r tsconfig-paths/register src/console-apps/grabbers.js -g block -gd range-from-to -n 2000000 1000001
npx ts-node -r tsconfig-paths/register src/console-apps/grabbers.js -g block -gd range-from-to -n 3000000 2000001 
```
this way you will grab block from 1 to 3 milion in parallel.


### 6. Prisma: Prisma Schema Development

Update the Prisma schema `prisma/schema.prisma` and after that run the following two commands:

```bash
npx prisma generate
# or in watch mode
npx prisma generate --watch
# or
npm run prisma:generate
npm run prisma:generate:watch
```

### 7. Prisma: Prisma Client JS

[Prisma Client JS](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/api) is a type-safe database client auto-generated based on the data model. It could be used for futher development

Generate Prisma Client JS by running

> **Note**: Every time you update [schema.prisma](prisma/schema.prisma) re-generate Prisma Client JS

```bash
npx prisma generate
# or
npm run prisma:generate
```

### 7. Start NestJS Server

!!! not working now !!!

In case you would like to run API or GraphQL server, you should deal with NestJS application. 

## Docker

Nest server is a Node.js application and it is easily [dockerized](https://nodejs.org/de/docs/guides/nodejs-docker-webapp/).

See the [Dockerfile](./Dockerfile) on how to build a Docker image of your Nest server.

Now to build a Docker image of your own Nest server simply run:

```bash
# give your docker image a name
docker build -t <your username>/nest-prisma-server .
# for example
docker build -t nest-prisma-server .
```

After Docker build your docker image you are ready to start up a docker container running the nest server:

```bash
docker run -d -t -p 3000:3000 --env-file .env nest-prisma-server
```

Now open up [localhost:3000](http://localhost:3000) to verify that your nest server is running.

When you run your NestJS application in a Docker container update your [.env](.env) file

```diff
- DB_HOST=localhost
# replace with name of the database container
+ DB_HOST=postgres

# Prisma database connection
+ DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${DB_HOST}:${DB_PORT}/${POSTGRES_DB}?schema=${DB_SCHEMA}&sslmode=prefer
```

If `DATABASE_URL` is missing in the root `.env` file, which is loaded into the Docker container, the NestJS application will exit with the following error:

```bash
(node:19) UnhandledPromiseRejectionWarning: Error: error: Environment variable not found: DATABASE_URL.
  -->  schema.prisma:3
   |
 2 |   provider = "postgresql"
 3 |   url      = env("DATABASE_URL")
```
### Docker Compose

You can also setup a the database and Nest application with the docker-compose

```bash
# building new NestJS docker image
docker-compose build
# or
npm run docker:build

# start docker-compose
docker-compose up -d
# or
npm run docker
```

**[⬆ back to top](#overview)**

