// Where each note fits in a bigger picture (<BigPicture>, shown under every note's title).
// A pipeline is the whole system drawn as parts in order; a part may be a group (the repeated
// layers). PLACES puts a concept on one part, with a short name and its role there. System notes
// are placed through the concepts they link to, so a model lights up every part it changes.

export const PIPELINES = {
  llm: {
    label: 'a language model, from text to the next token',
    parts: [
      { id: 'text', label: 'Text' },
      { id: 'tok', label: 'Tokenizer', link: 'byte-level-bpe' },
      { id: 'emb', label: 'Embedding' },
      {
        id: 'layers',
        label: 'Layer × L',
        link: 'transformer-block',
        parts: [
          { id: 'norm', label: 'Norm', link: 'layer-norm' },
          { id: 'pos', label: 'Position', link: 'rope' },
          { id: 'mix', label: 'Token mixer', link: 'mha' },
          { id: 'cache', label: 'KV cache', link: 'kv-cache' },
          { id: 'ffn', label: 'FFN or MoE', link: 'moe' },
          { id: 'res', label: 'Residual add', link: 'transformer-block' },
        ],
      },
      { id: 'head', label: 'Output head' },
      { id: 'next', label: 'Next token', loop: 'fed back in, one token per step' },
    ],
  },
  gen: {
    label: 'a diffusion or flow model, from noise to a sample',
    parts: [
      { id: 'noise', label: 'Noise' },
      { id: 'cond', label: 'Condition', link: 'adaln' },
      { id: 'den', label: 'Denoiser network', link: 'dit' },
      { id: 'vel', label: 'Velocity' },
      { id: 'step', label: 'ODE step × N', link: 'flow-matching' },
      { id: 'sample', label: 'Sample' },
    ],
  },
  vlm: {
    label: 'a vision-language model, from an image to text',
    parts: [
      { id: 'img', label: 'Image' },
      { id: 'enc', label: 'Vision encoder', link: 'c-radio' },
      { id: 'conn', label: 'Connector', link: 'vision-language-connector' },
      { id: 'lm', label: 'Language model', link: 'transformer-block' },
      { id: 'out', label: 'Answer' },
    ],
  },
  robot: {
    label: 'a robot policy, from camera and instruction to motion',
    parts: [
      { id: 'obs', label: 'Camera + instruction' },
      { id: 'vlm', label: 'Vision-language backbone', link: 'vla' },
      { id: 'head', label: 'Action head', link: 'flow-matching' },
      { id: 'chunk', label: 'Action chunk', link: 'action-chunking' },
      { id: 'act', label: 'Robot moves' },
    ],
  },
  hands: {
    label: 'hand motion, from video or a goal to a 3D hand',
    parts: [
      { id: 'in', label: 'Video or goal' },
      { id: 'net', label: 'Pose or motion model', link: 'dit' },
      { id: 'params', label: 'Pose + shape numbers', link: 'mano' },
      { id: 'mesh', label: '3D hand mesh' },
    ],
  },
  world: {
    label: 'a world model, from observations to imagined futures',
    parts: [
      { id: 'obs', label: 'Observation' },
      { id: 'enc', label: 'Encoder' },
      { id: 'state', label: 'Latent state', link: 'rssm' },
      { id: 'imag', label: 'Imagined steps' },
      { id: 'signal', label: 'Training signal', link: 'contrastive-world-models' },
    ],
  },
  learn: {
    label: 'learning from data, from a training set to test error',
    parts: [
      { id: 'data', label: 'Training set' },
      { id: 'model', label: 'Model size or knob', link: 'double-descent' },
      { id: 'fit', label: 'Fit' },
      { id: 'test', label: 'Error on new data', link: 'bias-variance-tradeoff' },
    ],
  },
};

/** slug -> { pipe, at, short, role }. `at` is a part id; role says what the note does there. */
export const PLACES = {
  'byte-level-bpe': { pipe: 'llm', at: 'tok', short: 'BPE', role: 'turns text into token ids' },
  'layer-norm': { pipe: 'llm', at: 'norm', short: 'LayerNorm', role: 'keeps every layer’s input the same size' },
  'group-norm': { pipe: 'llm', at: 'norm', short: 'GroupNorm', role: 'normalizes channel groups inside one example' },
  'transformer-block': { pipe: 'llm', at: 'layers', short: 'Block', role: 'the layer that is repeated L times' },
  rope: { pipe: 'llm', at: 'pos', short: 'RoPE', role: 'tells attention where each token is' },
  mha: { pipe: 'llm', at: 'mix', short: 'MHA', role: 'attention with its own K, V per head' },
  mqa: { pipe: 'llm', at: 'mix', short: 'MQA', role: 'attention with one shared K, V' },
  gqa: { pipe: 'llm', at: 'mix', short: 'GQA', role: 'attention with K, V shared per group' },
  mla: { pipe: 'llm', at: 'mix', short: 'MLA', role: 'attention that caches one small latent' },
  dsa: { pipe: 'llm', at: 'mix', short: 'DSA', role: 'attention over only the top-scored tokens' },
  'gated-short-conv': { pipe: 'llm', at: 'mix', short: 'Short conv', role: 'a mixer that reads only nearby tokens' },
  'mamba-2': { pipe: 'llm', at: 'mix', short: 'Mamba-2', role: 'a mixer with a fixed-size state' },
  'gated-deltanet': { pipe: 'llm', at: 'mix', short: 'Gated DeltaNet', role: 'a linear-attention mixer' },
  'hybrid-conv-attention': { pipe: 'llm', at: 'mix', short: 'Conv + attention', role: 'mostly conv layers, a few attention' },
  'hybrid-ssm-attention': { pipe: 'llm', at: 'mix', short: 'Mamba + attention', role: 'mostly Mamba layers, a few attention' },
  'kv-cache': { pipe: 'llm', at: 'cache', short: 'KV cache', role: 'keeps past keys and values between steps' },
  moe: { pipe: 'llm', at: 'ffn', short: 'MoE', role: 'many experts, a few used per token' },
  'deepseek-moe': { pipe: 'llm', at: 'ffn', short: 'DeepSeekMoE', role: 'small experts plus shared ones' },
  'latent-moe': { pipe: 'llm', at: 'ffn', short: 'LatentMoE', role: 'experts that work in a smaller width' },
  'aux-loss-free-balancing': { pipe: 'llm', at: 'ffn', short: 'Bias balancing', role: 'keeps the router’s experts evenly busy' },
  flashmoe: { pipe: 'llm', at: 'ffn', short: 'FlashMoE', role: 'loads experts from SSD on small devices' },
  engram: { pipe: 'llm', at: 'res', short: 'Engram', role: 'adds a looked-up memory to the stream' },
  mhc: { pipe: 'llm', at: 'res', short: 'mHC', role: 'widens the residual stream into copies' },
  mtp: { pipe: 'llm', at: 'head', short: 'MTP', role: 'predicts several next tokens' },
  'fp8-training': { pipe: 'llm', at: 'layers', short: 'FP8', role: 'the number format of every matrix multiply' },
  nvfp4: { pipe: 'llm', at: 'layers', short: 'NVFP4', role: 'a 4-bit number format for the weights' },
  adaln: { pipe: 'gen', at: 'cond', short: 'AdaLN', role: 'feeds the condition into every block' },
  dit: { pipe: 'gen', at: 'den', short: 'DiT', role: 'a transformer as the denoiser' },
  'flow-matching': { pipe: 'gen', at: 'step', short: 'Flow matching', role: 'learns the velocity, then steps along it' },
  'c-radio': { pipe: 'vlm', at: 'enc', short: 'C-RADIO', role: 'turns the image into patch features' },
  'vision-language-connector': { pipe: 'vlm', at: 'conn', short: 'Connector', role: 'turns patch features into tokens' },
  vla: { pipe: 'robot', at: 'vlm', short: 'VLA', role: 'the whole policy' },
  'action-chunking': { pipe: 'robot', at: 'chunk', short: 'Chunking', role: 'many actions per prediction' },
  'observation-reuse': { pipe: 'robot', at: 'head', short: 'Obs reuse', role: 'computes the observation once per request' },
  mano: { pipe: 'hands', at: 'params', short: 'MANO', role: 'turns a few numbers into a hand mesh' },
  rssm: { pipe: 'world', at: 'state', short: 'RSSM', role: 'the latent state that steps forward' },
  'contrastive-world-models': { pipe: 'world', at: 'signal', short: 'Contrastive', role: 'learns without drawing pixels' },
  'bias-variance-tradeoff': { pipe: 'learn', at: 'test', short: 'Bias–variance', role: 'splits test error into its parts' },
  'double-descent': { pipe: 'learn', at: 'model', short: 'Double descent', role: 'how error moves as the model grows' },
};

/** Tokenizer notes sit on the tokenizer part. */
export function placeOf(slug, kind) {
  if (PLACES[slug]) return PLACES[slug];
  if (kind === 'system' && /tokenizer$/.test(slug)) return { pipe: 'llm', at: 'tok', short: 'Tokenizer', role: 'this model’s tokenizer' };
  return null;
}

export const flatParts = (pipe) => PIPELINES[pipe].parts.flatMap((p) => (p.parts ? [p, ...p.parts] : [p]));
