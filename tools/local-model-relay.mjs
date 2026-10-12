// WSL専用interfaceとWindows loopbackの間だけを接続する、一時的なTCP中継。
// モデル要求を加工・再試行・記録せず、終了時に接続も閉じる。
import net from 'node:net';
const [bindAddress, portText, upstreamText] = process.argv.slice(2);
const port = Number(portText);
const upstreamPort = Number(upstreamText);
if (!/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(bindAddress ?? '')
  || !Number.isInteger(port) || port < 1024 || port > 65535
  || !Number.isInteger(upstreamPort) || upstreamPort < 1024 || upstreamPort > 65535) {
  throw new Error('Expected private WSL interface and explicit ports');
}
const sockets = new Set();
const server = net.createServer((client) => {
  const upstream = net.createConnection({ host: '127.0.0.1', port: upstreamPort });
  for (const socket of [client, upstream]) {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => { client.destroy(); upstream.destroy(); });
  }
  client.pipe(upstream).pipe(client);
});
server.listen(port, bindAddress, () => console.log(`relay ${bindAddress}:${port} -> loopback:${upstreamPort}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  for (const socket of sockets) socket.destroy();
  server.close();
});
