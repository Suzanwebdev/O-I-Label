/**
 * Visual-only Ghana Mobile Money network marks for checkout.
 * Not selectable payment methods — indicators next to the single MoMo option.
 */
export function MomoNetworkLogos({ className }: { className?: string }) {
  return (
    <span
      className={
        className ??
        "inline-flex max-w-full flex-wrap items-center gap-1.5"
      }
      aria-label="Accepted networks: MTN Mobile Money, Telecel Cash, and AirtelTigo AT Money"
    >
      <MtnLogo />
      <TelecelLogo />
      <AtMoneyLogo />
    </span>
  );
}

function MtnLogo() {
  return (
    <svg
      role="img"
      aria-label="MTN Mobile Money"
      width="40"
      height="18"
      viewBox="0 0 40 18"
      className="h-[18px] w-auto shrink-0"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>MTN Mobile Money</title>
      <rect width="40" height="18" rx="3" fill="#FFCC00" />
      <text
        x="20"
        y="12.5"
        textAnchor="middle"
        fill="#000"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="8.5"
        fontWeight="800"
        letterSpacing="0.04em"
      >
        MTN
      </text>
    </svg>
  );
}

function TelecelLogo() {
  return (
    <svg
      role="img"
      aria-label="Telecel Cash"
      width="52"
      height="18"
      viewBox="0 0 52 18"
      className="h-[18px] w-auto shrink-0"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Telecel Cash</title>
      <rect width="52" height="18" rx="3" fill="#E30613" />
      <text
        x="26"
        y="12.5"
        textAnchor="middle"
        fill="#fff"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="7"
        fontWeight="700"
        letterSpacing="0.02em"
      >
        Telecel
      </text>
    </svg>
  );
}

function AtMoneyLogo() {
  return (
    <svg
      role="img"
      aria-label="AirtelTigo AT Money"
      width="44"
      height="18"
      viewBox="0 0 44 18"
      className="h-[18px] w-auto shrink-0"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>AirtelTigo AT Money</title>
      <rect width="44" height="18" rx="3" fill="#1A1A1A" />
      <text
        x="11"
        y="12.5"
        textAnchor="middle"
        fill="#ED1C24"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="8"
        fontWeight="800"
      >
        AT
      </text>
      <text
        x="30"
        y="12.5"
        textAnchor="middle"
        fill="#fff"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="6.5"
        fontWeight="600"
        letterSpacing="0.01em"
      >
        Money
      </text>
    </svg>
  );
}
