export default function ComingSoon({ title = 'Coming Soon', note = 'This feature is not wired yet.' }) {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-muted-foreground">{note}</p>
      </div>
    </div>
  )
}
