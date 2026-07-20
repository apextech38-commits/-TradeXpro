// Standalone iframe embed of charts.tradexpro.co.ke for this shell app's
// top-level "/charts" nav route. Deliberately has NO dependency on useStore()
// or StoreProvider - this app tree (src/App.tsx) never mounts a StoreProvider
// (that only exists in the separate botbuilder.tradexpro.co.ke deployment),
// so any component here that calls useStore() will crash with
// "Cannot destructure property 'x' of useStore(...) as it is null" - which is
// exactly what happened when this route rendered the raw chart.tsx component.
const ChartsEmbed = () => (
    <iframe
        src='https://charts.tradexpro.co.ke'
        title='TradeXpro Charts'
        style={{
            width: '100%',
            height: '100%',
            minHeight: '100%',
            flex: 1,
            border: 'none',
            display: 'block',
        }}
        allow='fullscreen'
    />
);

export default ChartsEmbed;
