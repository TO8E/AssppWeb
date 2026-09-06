export default function Switch({ checked, onChange, labelledBy, describedBy }: { checked: boolean; onChange: (checked: boolean) => void; labelledBy: string; describedBy?: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-labelledby={labelledBy} aria-describedby={describedBy} onClick={() => onChange(!checked)} className="inline-flex h-11 w-12 shrink-0 items-center justify-center rounded-md">
    <span aria-hidden="true" className={`flex h-7 w-12 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}>
      <span className={`h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </span>
  </button>;
}
