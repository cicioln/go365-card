<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { SeoPageKey, SiteConfig } from '../../data/mock'
import { SEO_PAGES, resolveMeta } from '../../utils/seo'
import { adminApi } from '../../adminApi'
import { DEFAULT_LOGO, useSiteStore } from '../../stores/site'
import ImageUpload from '../../components/admin/ImageUpload.vue'
import { useUiStore } from '../../stores/ui'
import { errorText } from '../../http'

const siteStore = useSiteStore()
const ui = useUiStore()

const site = ref<SiteConfig>({ ...siteStore.site })
// ImageUpload 移除图片时给 undefined，这里统一转成空串
const logo = computed({ get: () => site.value.logo || undefined, set: (v) => (site.value.logo = v ?? '') })
const favicon = computed({ get: () => site.value.favicon || undefined, set: (v) => (site.value.favicon = v ?? '') })
const siteError = ref('')
const oldPwd = ref('')
const newPwd = ref('')
const pwdError = ref('')
const busy = ref(false)

// SEO：每个页面都给出 title/description 两个输入框，留空用默认值
const seoPages = ref(Object.fromEntries(SEO_PAGES.map((p) => [p.key, { title: '', description: '' }])) as Record<SeoPageKey, { title: string; description: string }>)
const seoError = ref('')
function fillSeo() {
  for (const p of SEO_PAGES) seoPages.value[p.key] = { title: '', description: '', ...site.value.seo?.pages?.[p.key] }
}
/** 预览：用当前输入计算出的最终标题 */
const seoPreview = (path: string) => resolveMeta({ ...site.value, seo: { ...site.value.seo, pages: seoPages.value } }, path)

onMounted(async () => {
  try {
    site.value = await adminApi.site()
    fillSeo()
  } catch (e) {
    siteError.value = errorText(e)
  }
})

async function saveSite(which: 'site' | 'seo' = 'site') {
  const err = which === 'site' ? siteError : seoError
  err.value = ''
  busy.value = true
  try {
    siteStore.site = site.value = await adminApi.saveSite({ ...site.value, seo: { ...site.value.seo, pages: seoPages.value } })
    fillSeo()
    ui.notify(which === 'site' ? '站点设置已保存' : 'SEO 设置已保存')
  } catch (e) {
    err.value = errorText(e)
  } finally {
    busy.value = false
  }
}

async function changePwd() {
  pwdError.value = ''
  if (newPwd.value.length < 8) return (pwdError.value = '新密码至少 8 位')
  try {
    await adminApi.changePassword(oldPwd.value, newPwd.value)
    oldPwd.value = newPwd.value = ''
    ui.notify('密码已修改，其它设备上的登录已失效')
  } catch (e) {
    pwdError.value = errorText(e)
  }
}
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-2">
    <form class="card space-y-4 p-6" @submit.prevent="saveSite('site')">
      <h2 class="font-bold">站点信息</h2>
      <div><label class="label" for="s-name">站点名称</label><input id="s-name" v-model="site.siteName" class="input" required /></div>
      <div><label class="label" for="s-desc">站点描述</label><input id="s-desc" v-model="site.description" class="input" /></div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <span class="label">网站 Logo</span>
          <div class="mb-2 flex h-16 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <img :src="site.logo || DEFAULT_LOGO" alt="Logo 预览" class="h-10 w-10 rounded-md object-contain" :class="{ 'dark:invert': !site.logo }" />
          </div>
          <ImageUpload v-model="logo" raw label="上传 Logo" hint="建议正方形透明 PNG，≤ 3MB" />
          <p class="mt-1.5 text-xs text-zinc-400">显示在页头、页脚和后台，留空使用默认 Logo</p>
        </div>
        <div>
          <span class="label">浏览器标签图标</span>
          <div class="mb-2 flex h-16 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <img :src="site.favicon || site.logo || DEFAULT_LOGO" alt="图标预览" class="h-8 w-8 rounded object-contain" :class="{ 'dark:invert': !site.favicon && !site.logo }" />
          </div>
          <ImageUpload v-model="favicon" raw label="上传图标" hint="建议 64×64 正方形 PNG" />
          <p class="mt-1.5 text-xs text-zinc-400">留空则使用网站 Logo</p>
        </div>
      </div>
      <div><label class="label" for="s-tg">Telegram 群链接</label><input id="s-tg" v-model="site.telegram" type="url" class="input" placeholder="https://t.me/xxx" /><p class="mt-1.5 text-xs text-zinc-400">留空则前台不显示 TG 交流群入口</p></div>
      <div>
        <label class="label" for="s-cur">货币</label>
        <select id="s-cur" v-model="site.currency" class="input"><option>CNY</option><option>USD</option></select>
        <p class="mt-1.5 text-xs text-zinc-400">只改变显示的货币符号，不做汇率换算，请确保与支付网关结算币种一致</p>
      </div>
      <p v-if="siteError" role="alert" class="text-sm text-red-500">{{ siteError }}</p>
      <button class="btn-primary" :disabled="busy">保存</button>
    </form>

    <form class="card h-fit space-y-4 p-6" @submit.prevent="changePwd">
      <h2 class="font-bold">修改管理员密码</h2>
      <input value="admin" autocomplete="username" class="sr-only" tabindex="-1" aria-hidden="true" readonly />
      <div><label class="label" for="s-old">原密码</label><input id="s-old" v-model="oldPwd" type="password" autocomplete="current-password" class="input" required /></div>
      <div><label class="label" for="s-new">新密码（至少 8 位）</label><input id="s-new" v-model="newPwd" type="password" autocomplete="new-password" class="input" required /></div>
      <p v-if="pwdError" role="alert" class="text-sm text-red-500">{{ pwdError }}</p>
      <button class="btn-primary">修改密码</button>
    </form>

    <form class="card space-y-5 p-6 xl:col-span-2" @submit.prevent="saveSite('seo')">
      <div>
        <h2 class="font-bold">SEO 设置</h2>
        <p class="mt-1 text-xs text-zinc-400">
          网页标题、描述和关键词会直接写进页面 HTML，搜索引擎和分享卡片可以读取。初始值在首次安装时写入，之后以这里填写的为准；标题留空显示站点名称，描述留空使用站点描述。
          商品和文章详情页会自动使用商品标题/简介、文章标题/摘要。
        </p>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="seo-tpl">标题模板</label>
          <input id="seo-tpl" v-model="site.seo.titleTemplate" class="input font-mono" placeholder="例如 {title} - {site}" />
          <p class="mt-1.5 text-xs text-zinc-400"><code>{title}</code> 为页面标题，<code>{site}</code> 为站点名称；留空只显示页面标题，首页不套模板</p>
        </div>
        <div>
          <label class="label" for="seo-kw">关键词（keywords）</label>
          <input id="seo-kw" v-model="site.seo.keywords" class="input" placeholder="例如：ChatGPT Plus, Claude Pro, 自动发货" />
          <p class="mt-1.5 text-xs text-zinc-400">逗号分隔，全站共用</p>
        </div>
      </div>

      <div class="overflow-hidden rounded-xl border border-black/5 dark:border-white/10">
        <div class="hidden grid-cols-[7rem_1fr_1.4fr] gap-3 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-500 md:grid dark:bg-zinc-900">
          <span>页面</span><span>标题（title）</span><span>描述（description）</span>
        </div>
        <div
          v-for="p in SEO_PAGES"
          :key="p.key"
          class="grid gap-2 border-t border-black/5 px-4 py-3 first:border-t-0 md:grid-cols-[7rem_1fr_1.4fr] md:gap-3 md:first:border-t dark:border-white/10"
        >
          <div class="text-sm">
            <p class="font-semibold">{{ p.label }}</p>
            <p class="font-mono text-xs text-zinc-400">{{ p.path }}</p>
          </div>
          <div>
            <label class="sr-only" :for="`seo-t-${p.key}`">{{ p.label }}标题</label>
            <input :id="`seo-t-${p.key}`" v-model="seoPages[p.key].title" class="input py-2 text-sm" placeholder="留空显示站点名称" maxlength="80" />
            <p class="mt-1 truncate text-xs text-zinc-400" :title="seoPreview(p.path).title">显示为：{{ seoPreview(p.path).title }}</p>
          </div>
          <div>
            <label class="sr-only" :for="`seo-d-${p.key}`">{{ p.label }}描述</label>
            <textarea :id="`seo-d-${p.key}`" v-model="seoPages[p.key].description" rows="2" class="input py-2 text-sm" :placeholder="site.description || '留空使用站点描述'" maxlength="300" />
          </div>
        </div>
      </div>

      <p v-if="seoError" role="alert" class="text-sm text-red-500">{{ seoError }}</p>
      <button class="btn-primary" :disabled="busy">保存 SEO 设置</button>
    </form>
  </div>
</template>
