import { extensionOptions, extensionPost } from "../handler";
export async function OPTIONS(request: Request) { return extensionOptions(request); }
export async function POST(request: Request) { return extensionPost(request, "sync-quantity"); }
