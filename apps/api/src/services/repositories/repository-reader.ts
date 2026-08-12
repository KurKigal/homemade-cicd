export interface RepositoryReader {
  listRootEntryNames(
    owner: string,
    repo: string,
  ): Promise<Set<string>>;

  readTextFile(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<string | null>;

  pathExists(
    owner: string,
    repo: string,
    path: string,
  ): Promise<boolean>;
}