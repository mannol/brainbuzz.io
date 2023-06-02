function calculateRequiredTokens(sourceLength: number) {
  const withoutFirst = Math.max(sourceLength - 6144, 0)
  const remaining = withoutFirst / 5120 + (withoutFirst % 5120 === 0 ? 0 : 1)

  const passesRequired = 1 + remaining

  return Math.floor((passesRequired - 1) / 8) + 1
}

export default calculateRequiredTokens
