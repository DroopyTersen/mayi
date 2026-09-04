/** Bounded independent trials; no later batch starts after a job fails. */
export async function runAIPlayerEvalBatches<Input, Output>(
  inputs: readonly Input[],
  concurrency: number,
  run: (input: Input) => Promise<Output>,
): Promise<Output[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("Concurrency must be a positive integer");
  }
  const outputs: Output[] = [];
  for (let offset = 0; offset < inputs.length; offset += concurrency) {
    const batch = await Promise.allSettled(
      inputs.slice(offset, offset + concurrency).map(run),
    );
    for (const result of batch) {
      if (result.status === "rejected") throw result.reason;
      outputs.push(result.value);
    }
  }
  return outputs;
}
