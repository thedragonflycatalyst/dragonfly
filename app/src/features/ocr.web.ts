// No live scanner on the web dashboard (it uses a photo or screenshot upload instead).
export async function readText(_uri: string): Promise<string> { return ''; }
