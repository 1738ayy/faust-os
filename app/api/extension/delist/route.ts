import { extensionOptions, extensionPost } from "../handler";
export async function OPTIONS() { return extensionOptions(); }
export async function POST(request: Request) { return extensionPost(request, "delist-draft"); }
