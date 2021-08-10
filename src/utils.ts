export async function waitFor(ms: number) {
  await setTimeout(() => console.log(`waiting ${ms} miliseconds ....`), ms);
}

export async function waitForPromise(ms: number) {
  return new Promise((resolve) =>
    resolve(setTimeout(() => console.log(`waiting ${ms} miliseconds ....`), ms))
  );
}
