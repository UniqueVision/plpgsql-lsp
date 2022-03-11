export const asyncFlatMap = async <Item, Res>(
  arr: Item[],
  callback: (value: Item, index: number, array: Item[]) => Promise<Res>,
) => {
  return (
    await Promise.all(arr.map(callback))
  ).flat()
}
