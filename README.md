# council-dao

A self-contained, static web interface for a multisig-governed council.

The council reads a public queue of submitted ideas from an on-chain registry and lets its signers approve or reject each one. Approving an idea promotes it into an on-chain proposal; rejecting it closes it. Anyone can open the app and read the queue; write actions require a connected wallet that is an owner of the governing Safe.

## Features

- Read-only view of the idea queue and each idea's state, open to anyone.
- Approve / reject actions gated to Safe owners, executed through the Safe
  (`approveHash` + `execTransaction`).
- Per-idea tally of on-chain approvals against the Safe threshold.
- No backend and no build step. Everything (including dependencies) is inlined
  into a single HTML file, so it can be served from any static host or a
  content-addressed network.

## Usage

Open `index.html` in a browser, or serve the folder from any static file host. Set the target chain and registry address in the configuration block at the top of the file before deploying.

## License

Licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE).
