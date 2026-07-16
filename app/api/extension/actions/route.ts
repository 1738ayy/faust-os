import { extensionOptions, extensionPost, extensionStatus } from "../handler";

export async function OPTIONS() { return extensionOptions(); }
export async function GET() { return extensionStatus(); }
export async function POST(request: Request) { return extensionPost(request); }
