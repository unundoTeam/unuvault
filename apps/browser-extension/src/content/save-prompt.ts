export function shouldPromptToSave(input: {
  submitted: boolean;
  knownCredential: boolean;
}) {
  return input.submitted && !input.knownCredential;
}
