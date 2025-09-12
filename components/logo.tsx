export type LogoStyle = 'handz' | 'Shardz'

export default function Logo({
  style = 'handz',
  ...props
}: { style?: LogoStyle } & React.SVGProps<SVGSVGElement>) {
  return style === 'Shardz' ? (
    <svg
      {...props}
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer shard */}
      <path
        d="M128 8 L176 76 L208 160 L128 248 L48 160 L80 76 Z"
        fill="currentColor"
      />
      {/* Facet lines */}
      <path
        d="M128 8 L128 248 M80 76 L176 76 M64 132 L192 132"
        stroke="currentColor"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.4"
      />
    </svg>
  ) : (
    <svg
      {...props}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Hand outline */}
      <path
        d="M100 20C85 20 70 30 60 45C50 30 35 20 20 20C10 20 0 30 0 40C0 50 10 60 20 60C25 60 30 55 30 50C30 45 35 40 40 40C45 40 50 45 50 50C50 55 55 60 60 60C65 60 70 55 70 50C70 45 75 40 80 40C85 40 90 45 90 50C90 55 95 60 100 60C105 60 110 55 110 50C110 45 115 40 120 40C125 40 130 45 130 50C130 55 135 60 140 60C145 60 150 55 150 50C150 45 155 40 160 40C165 40 170 45 170 50C170 55 175 60 180 60C190 60 200 50 200 40C200 30 190 20 180 20C165 20 150 30 140 45C130 30 115 20 100 20Z"
        fill="currentColor"
      />
      {/* Palm */}
      <path
        d="M100 60C85 60 70 70 60 85C50 70 35 60 20 60C10 60 0 70 0 80C0 90 10 100 20 100C25 100 30 95 30 90C30 85 35 80 40 80C45 80 50 85 50 90C50 95 55 100 60 100C65 100 70 95 70 90C70 85 75 80 80 80C85 80 90 85 90 90C90 95 95 100 100 100C105 100 110 95 110 90C110 85 115 80 120 80C125 80 130 85 130 90C130 95 135 100 140 100C145 100 150 95 150 90C150 85 155 80 160 80C165 80 170 85 170 90C170 95 175 100 180 100C190 100 200 90 200 80C200 70 190 60 180 60C165 60 150 70 140 85C130 70 115 60 100 60Z"
        fill="currentColor"
        opacity="0.8"
      />
      {/* Fingers */}
      <path
        d="M30 60C25 60 20 65 20 70C20 75 25 80 30 80C35 80 40 75 40 70C40 65 35 60 30 60Z"
        fill="currentColor"
      />
      <path
        d="M50 60C45 60 40 65 40 70C40 75 45 80 50 80C55 80 60 75 60 70C60 65 55 60 50 60Z"
        fill="currentColor"
      />
      <path
        d="M70 60C65 60 60 65 60 70C60 75 65 80 70 80C75 80 80 75 80 70C80 65 75 60 70 60Z"
        fill="currentColor"
      />
      <path
        d="M90 60C85 60 80 65 80 70C80 75 85 80 90 80C95 80 100 75 100 70C100 65 95 60 90 60Z"
        fill="currentColor"
      />
      <path
        d="M110 60C105 60 100 65 100 70C100 75 105 80 110 80C115 80 120 75 120 70C120 65 115 60 110 60Z"
        fill="currentColor"
      />
      <path
        d="M130 60C125 60 120 65 120 70C120 75 125 80 130 80C135 80 140 75 140 70C140 65 135 60 130 60Z"
        fill="currentColor"
      />
      <path
        d="M150 60C145 60 140 65 140 70C140 75 145 80 150 80C155 80 160 75 160 70C160 65 155 60 150 60Z"
        fill="currentColor"
      />
      <path
        d="M170 60C165 60 160 65 160 70C160 75 165 80 170 80C175 80 180 75 180 70C180 65 175 60 170 60Z"
        fill="currentColor"
      />
    </svg>
  )
}
