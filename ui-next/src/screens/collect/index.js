// UI Next (v4) collect lane screens for /next/?ui_next=on&screen=<name>. Status: provisional.
// Owned by the collect lane cook of the screens fanout: only that lane edits this file (and the rest of screens/collect/).
// Default export maps screen name -> Svelte component; names are lowercase kebab-case, unique across all lanes and the
// built-in views (registry.js throws otherwise). The route passes props { phone, theme, state }: phone from ?w=phone,
// theme "light" | "dark", state the raw ?state= value (undefined when absent).
// Boards (cookbook design/2026-10-15-glass-redesign/canvas): collect = Collect, CollectPhone (&w=phone), CollectMenu (&state=menu),
// CollectMenuPhone (&w=phone&state=menu), CollectDark (&theme=dark); close-collection = CloseCollection, CloseCollectionPhone;
// qr-room = QRRoom, QRRoomPhone (&w=phone[&state=1..5]); print-qr = PrintQR, PrintQRPhone.
import Collect from "./Collect.svelte";
import CloseCollection from "./CloseCollection.svelte";
import QRRoom from "./QRRoom.svelte";
import PrintQR from "./PrintQR.svelte";
export default { collect: Collect, "close-collection": CloseCollection, "qr-room": QRRoom, "print-qr": PrintQR };
