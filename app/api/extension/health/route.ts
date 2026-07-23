import { extensionOptions, extensionStatus } from "../handler";

export async function OPTIONS(request: Request) {
  return extensionOptions(request);
}

export async function GET(request: Request) {
  return extensionStatus(request);
}
