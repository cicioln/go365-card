import sanitizeHtml from 'sanitize-html'

/** 富文本白名单：与后台编辑器（Tiptap）能产生的标签保持一致，去掉脚本、事件属性和危险链接 */
export function cleanHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'hr', 'a', 'img', 'span'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt'],
      p: ['style'],
      span: ['style'],
    },
    allowedStyles: { '*': { color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i] } },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    // 站内上传的图片使用相对路径 /uploads/xxx
    allowProtocolRelative: false,
    transformTags: {
      a: (tag, attribs) => ({ tagName: tag, attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' } }),
    },
  })
}
