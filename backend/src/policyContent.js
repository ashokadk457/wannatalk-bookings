import sanitizeHtml from 'sanitize-html';
export function cleanPolicyHtml(value) {
  return sanitizeHtml(value, {
    allowedTags: ['p','br','h2','h3','strong','b','em','i','u','s','ul','ol','li','blockquote','hr','a'],
    allowedAttributes: { a: ['href','target','rel'], ol: ['start'] },
    allowedSchemes: ['https','http','mailto','tel'],
    allowProtocolRelative: false,
    transformTags: { a: sanitizeHtml.simpleTransform('a', { target:'_blank', rel:'noopener noreferrer' }) },
  });
}
