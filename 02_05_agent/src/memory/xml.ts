export const extractTag = (text: string, tag: string): string | undefined => {
  const match = text.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return match?.[1]?.trim() || undefined
}
