export default function BotBuilder() {
  return (
    <div
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        minHeight: 0,
      }}
    >
      <iframe
        src="https://dbot.deriv.com"
        style={{
          position: "absolute",
          top: -120,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "calc(100% + 120px)",
          border: "none",
        }}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
