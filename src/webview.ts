import { $, type Socket, type TCPSocket, type TCPSocketListener } from 'bun';
import _Webview from './lib/Webview'
import { type Pointer } from "bun:ffi";

let port = parseInt(getArgVal('-port') || '0');
let hostname = getArgVal('-hostname');

const queue: string[] = []
let serverSocket: TCPSocket
let webview: _Webview

/** Window size */
export interface Size {
	/** The width of the window */
	width: number,
	/** The height of the window */
	height: number,
	/** The window size hint */
	hint: SizeHint,
}

/** Window size hints */
export const enum SizeHint {
	/** Width and height are default size */
	NONE,
	/** Width and height are minimum bounds */
	MIN,
	/** Width and height are maximum bounds */
	MAX,
	/** Window size can not be changed by a user */
	FIXED
};

export class Webview {
	socket!: Socket
	constructor(handle: Pointer);
	constructor(debug?: boolean, size?: Size, window?: Pointer | null);
	constructor(
		debugOrHandle: boolean | Pointer = false,
		size: Size | undefined = { width: 1024, height: 768, hint: SizeHint.NONE },
		window: Pointer | null = null,
	) {
		const args = typeof debugOrHandle === "bigint" || typeof debugOrHandle === "number"
			? [debugOrHandle]
			: [debugOrHandle, size, window]
		$`bun ${__filename} -port ${port} -hostname ${hostname} -args ${JSON.stringify(args)}`.then((shell) => null)
	}
	run() {
		write('run')
	}
}

if (!port && !hostname) {
	port = await getOpenPort(17500);
	hostname = await makeSocketServer(port).hostname;

} else {
	const webviewArgs: [...any] = JSON.parse(getArgVal('-args')!);
	webview = new _Webview(...webviewArgs)
	const socketClient = await makeSocketClient(port, hostname!, webview as unknown as Record<string, (...args: any[]) => void>)
}

function write(...args: any[]) {
	if (!!args) queue.push(JSON.stringify(args));
	!serverSocket ? setTimeout(() => {
		write()
	}) : queue.forEach(argString => serverSocket.write(argString))
}

function makeSocketServer(port: number, hostname = 'localhost') {
	return Bun.listen({
		hostname,
		port,
		socket: {
			open: (socket) => {
				serverSocket = socket
			},
			data: (socket, data) => { }
		}
	})
}
function makeSocketClient(port: number, hostname: string, webview: Record<string, (...args: any[]) => void>) {
	return Bun.connect({
		hostname, port,
		socket: {
			data: (socket, data) => {
				const instruction: [...any] = JSON.parse(data.toString());
				const command: string = instruction.shift();
				webview[command](...instruction)
			}
		}
	})
}
function getOpenPort(port: number): Promise<number> {
	return $`echo $(lsof -i :${port})`.then(shell => {
		return !shell.text().trim() ? port : getOpenPort(port + 1)
	});
}
function getArgVal(arg: string) {
	const index = process.argv.indexOf(arg) + 1;
	return index > 0 ? process.argv[index] : undefined;
}

