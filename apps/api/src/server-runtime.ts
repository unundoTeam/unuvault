type ListenOptions = {
  host: string;
  port: number;
};

type FastifyListenLike = {
  listen(options: ListenOptions): Promise<string>;
};

type LoggerLike = {
  info(message: string): void;
};

export async function startApiServer(
  server: FastifyListenLike,
  env: NodeJS.ProcessEnv = process.env,
  logger: LoggerLike = console,
) {
  const port = Number.parseInt(env.PORT ?? "3000", 10);
  const host = env.HOST ?? "127.0.0.1";
  const address = await server.listen({
    host,
    port,
  });

  logger.info(`API listening at ${address}`);
}
