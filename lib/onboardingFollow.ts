/**
 * Folgt den IDs nacheinander. Ein Fehler stoppt die übrigen nicht,
 * er wird nur gezählt. Private Profile bekommen über `follow` eine Anfrage.
 */
export async function followAll(
  ids: readonly string[],
  follow: (id: string) => Promise<unknown>,
): Promise<{ failed: number }> {
  let failed = 0;
  for (const id of ids) {
    try {
      await follow(id);
    } catch {
      failed += 1;
    }
  }
  return { failed };
}
