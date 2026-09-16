declare module "@multiavatar/multiavatar/esm" {
  export default function multiavatar(
    seed: string,
    sansEnvironment?: boolean,
    version?: { part?: string; theme?: string },
  ): string;
}
