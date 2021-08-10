export interface Config {
  nest: NestConfig;
  cors: CorsConfig;
  swagger: SwaggerConfig;
  graphql: GraphqlConfig;
  security: SecurityConfig;
  chain: ChainConfig;
  tasks: TasksConfig;
}

export interface TasksConfig {
  runAtStartup: string;
}
export interface ChainConfig {
  name: string;
  wsEndPoint: string;
  denom: string;
  decimalPlaces: number;
}

export interface NestConfig {
  port: number;
}

export interface CorsConfig {
  enabled: boolean;
}

export interface SwaggerConfig {
  enabled: boolean;
  title: string;
  description: string;
  version: string;
  path: string;
}

export interface GraphqlConfig {
  playgroundEnabled: boolean;
  debug: boolean;
  schemaDestination: string;
  sortSchema: boolean;
}

export interface SecurityConfig {
  expiresIn: string;
  refreshIn: string;
  bcryptSaltOrRound: string | number;
}
