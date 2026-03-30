export const baselineFixtures = [
  {
    name: 'react-nested-helpers',
    adapter: 'react',
    code: `
      const klass = twMerge(cn('flex px-page', enabled ? 'bg-primary' : 'bg-surface'), cva('rounded-control'))
      export function Demo() { return <div className={klass + ' pressed:opacity-80'} /> }
    `,
    expected: ['flex', 'px-page', 'bg-primary', 'bg-surface', 'rounded-control', 'pressed:opacity-80'],
  },
  {
    name: 'vue-conditional-array-and-object',
    adapter: 'vue',
    code: `
      <template>
        <view
          class="px-page"
          :class="[
            isPrimary ? 'bg-primary text-on-primary' : 'bg-surface text-primary',
            { 'pressed:opacity-80': pressable, 'disabled:opacity-40': disabled },
            sizeMap[size] || 'py-section'
          ]"
        />
      </template>
    `,
    expected: [
      'px-page',
      'bg-primary',
      'text-on-primary',
      'bg-surface',
      'text-primary',
      'pressed:opacity-80',
      'disabled:opacity-40',
      'py-section',
    ],
  },
  {
    name: 'wechat-mustache-dynamic',
    adapter: 'wechat-wxml',
    code: `
      <view class="tm-px-page {{ enabled ? 'tm-bg-primary tm-text-on-primary' : 'tm-bg-surface tm-text-primary' }} tm-pressed:opacity-80"></view>
    `,
    expected: ['tm-px-page', 'tm-bg-primary', 'tm-text-on-primary', 'tm-bg-surface', 'tm-text-primary', 'tm-pressed:opacity-80'],
    absent: ['enabled', 'enabled?', 'enabled:', 'active:', 'idle:'],
  },
  {
    name: 'wechat-nested-object-mustache',
    adapter: 'wechat-wxml',
    code: `
      <view class="tm-px-page {{ ({ active: 'tm-bg-primary tm-text-on-primary', idle: 'tm-bg-surface' })[state] }} tm-rounded-card"></view>
    `,
    expected: ['tm-px-page', 'tm-bg-primary', 'tm-text-on-primary', 'tm-bg-surface', 'tm-rounded-card'],
    absent: ['active:', 'idle:'],
  },
]
