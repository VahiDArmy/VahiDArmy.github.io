// Generated from the OpenRouter catalog by scripts/build-seed.mjs.
// Only used to bootstrap an empty registry; the live registry comes from sync.
export const SEED_MODELS = [
 {
  "id": "openrouter/auto-code",
  "name": "Auto Code",
  "provider": "openrouter",
  "description": "Auto Code is OpenRouter’s router built specifically for coding agents and harnesses. It uses the same routing engine as the [Auto Router](https://openrouter.ai/openrouter/auto), with every request treated as part of an...",
  "context_length": 2000000,
  "max_output": 64000,
  "price_in": -1000000,
  "price_out": -1000000,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+file+audio+video->text+image",
  "created_at_remote": 1793884321,
  "raw": {
   "supported_parameters": [
    "frequency_penalty",
    "include_reasoning",
    "logit_bias",
    "logprobs",
    "max_completion_tokens",
    "max_tokens",
    "min_p",
    "parallel_tool_calls",
    "presence_penalty",
    "reasoning",
    "reasoning_effort",
    "repetition_penalty",
    "response_format",
    "seed",
    "stop",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools",
    "top_a",
    "top_k",
    "top_logprobs",
    "top_p",
    "verbosity"
   ],
   "input_modalities": [
    "text",
    "image",
    "audio",
    "file",
    "video"
   ]
  }
 },
 {
  "id": "openrouter/auto",
  "name": "Auto Router",
  "provider": "openrouter",
  "description": "Auto is OpenRouter’s flagship model router, built for general-purpose usage. It adapts to each request, choosing cost-optimal models and adjusting reasoning effort. It balances task difficulty, benchmark results, live prices,...",
  "context_length": 2000000,
  "max_output": 0,
  "price_in": -1000000,
  "price_out": -1000000,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+file+audio+video->text+image",
  "created_at_remote": 1793885889,
  "raw": {
   "supported_parameters": [
    "frequency_penalty",
    "include_reasoning",
    "logit_bias",
    "logprobs",
    "max_tokens",
    "min_p",
    "prediction",
    "presence_penalty",
    "reasoning",
    "reasoning_effort",
    "repetition_penalty",
    "response_format",
    "seed",
    "stop",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools",
    "top_a",
    "top_k",
    "top_logprobs",
    "top_p",
    "web_search_options"
   ],
   "input_modalities": [
    "text",
    "image",
    "audio",
    "file",
    "video"
   ]
  }
 },
 {
  "id": "openrouter/auto-beta",
  "name": "Auto Router (Beta)",
  "provider": "openrouter",
  "description": "The experimental version of our Auto Router where we test new improvements. Use it to get the latest and greatest version of our general purpose auto router, but expect beta...",
  "context_length": 2000000,
  "max_output": 64000,
  "price_in": -1000000,
  "price_out": -1000000,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+file+audio+video->text+image",
  "created_at_remote": 1784311165,
  "raw": {
   "supported_parameters": [
    "frequency_penalty",
    "include_reasoning",
    "logit_bias",
    "logprobs",
    "max_completion_tokens",
    "max_tokens",
    "min_p",
    "parallel_tool_calls",
    "presence_penalty",
    "reasoning",
    "reasoning_effort",
    "repetition_penalty",
    "response_format",
    "seed",
    "stop",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools",
    "top_a",
    "top_k",
    "top_logprobs",
    "top_p",
    "verbosity"
   ],
   "input_modalities": [
    "text",
    "image",
    "audio",
    "file",
    "video"
   ]
  }
 },
 {
  "id": "baidu/ernie-5.5-flash-preview:free",
  "name": "Baidu: ERNIE-5.5-Flash-Preview (free)",
  "provider": "baidu",
  "description": "ERNIE 5.5 Flash Preview is the latest foundation model in the ERNIE family, with comprehensive improvements in coding, agentic capabilities, knowledge work, and deep research. It has 280 billion total...",
  "context_length": 1024000,
  "max_output": 921600,
  "price_in": 0,
  "price_out": 0,
  "is_free": true,
  "supports_tools": true,
  "supports_images": false,
  "modality": "text->text",
  "created_at_remote": 1794333533,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_tokens",
    "reasoning",
    "reasoning_effort",
    "response_format",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools",
    "top_p"
   ],
   "input_modalities": [
    "text"
   ]
  }
 },
 {
  "id": "cohere/north-mini-code:free",
  "name": "Cohere: North Mini Code (free)",
  "provider": "cohere",
  "description": "North Mini Code is Cohere's first agentic coding model and the debut of its North family. A sparse mixture-of-experts model with 30B total parameters and 3B active, it is optimized...",
  "context_length": 256000,
  "max_output": 64000,
  "price_in": 0,
  "price_out": 0,
  "is_free": true,
  "supports_tools": true,
  "supports_images": false,
  "modality": "text->text",
  "created_at_remote": 1781723748,
  "raw": {
   "supported_parameters": [
    "frequency_penalty",
    "include_reasoning",
    "max_tokens",
    "presence_penalty",
    "reasoning",
    "seed",
    "stop",
    "temperature",
    "tool_choice",
    "tools",
    "top_k",
    "top_p"
   ],
   "input_modalities": [
    "text"
   ]
  }
 },
 {
  "id": "dots-studio/dots-3-note-preview:free",
  "name": "Dots Studio: Dots3-Note Preview (free)",
  "provider": "dots-studio",
  "description": "Dots3-Note Preview is an open-weight mixture-of-experts model from Dots Studio, with 16B active parameters out of 280B total. It is the lightest model in the Dots 3 family and is...",
  "context_length": 512000,
  "max_output": 460800,
  "price_in": 0,
  "price_out": 0,
  "is_free": true,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image->text",
  "created_at_remote": 1786680361,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_tokens",
    "reasoning",
    "response_format",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools",
    "top_p"
   ],
   "input_modalities": [
    "text",
    "image"
   ]
  }
 },
 {
  "id": "openrouter/free",
  "name": "Free Models Router",
  "provider": "openrouter",
  "description": "The simplest way to get free inference. openrouter/free is a router that selects free models at random from the models available on OpenRouter. The router smartly filters for models that...",
  "context_length": 200000,
  "max_output": 0,
  "price_in": 0,
  "price_out": 0,
  "is_free": true,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image->text",
  "created_at_remote": 1769917427,
  "raw": {
   "supported_parameters": [
    "frequency_penalty",
    "include_reasoning",
    "logprobs",
    "max_completion_tokens",
    "max_tokens",
    "min_p",
    "presence_penalty",
    "reasoning",
    "reasoning_effort",
    "repetition_penalty",
    "response_format",
    "seed",
    "stop",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools",
    "top_k",
    "top_logprobs",
    "top_p"
   ],
   "input_modalities": [
    "text",
    "image"
   ]
  }
 },
 {
  "id": "google/gemma-4-26b-a4b-it:free",
  "name": "Google: Gemma 4 26B A4B  (free)",
  "provider": "google",
  "description": "Gemma 4 26B A4B IT is an instruction-tuned Mixture-of-Experts (MoE) model from Google DeepMind. Despite 25.2B total parameters, only 3.8B activate per token during inference — delivering near-31B quality at...",
  "context_length": 262144,
  "max_output": 32768,
  "price_in": 0,
  "price_out": 0,
  "is_free": true,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+video->text",
  "created_at_remote": 1775227989,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_tokens",
    "reasoning",
    "response_format",
    "seed",
    "temperature",
    "tool_choice",
    "tools",
    "top_p"
   ],
   "input_modalities": [
    "image",
    "text",
    "video"
   ]
  }
 },
 {
  "id": "google/gemma-4-31b-it:free",
  "name": "Google: Gemma 4 31B (free)",
  "provider": "google",
  "description": "Gemma 4 31B Instruct is Google DeepMind's 30.7B dense multimodal model supporting text and image input with text output. Features a 256K token context window, configurable thinking/reasoning mode, native function...",
  "context_length": 262144,
  "max_output": 32768,
  "price_in": 0,
  "price_out": 0,
  "is_free": true,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+video->text",
  "created_at_remote": 1775148486,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_tokens",
    "reasoning",
    "response_format",
    "seed",
    "temperature",
    "tool_choice",
    "tools",
    "top_p"
   ],
   "input_modalities": [
    "image",
    "text",
    "video"
   ]
  }
 },
 {
  "id": "google/lyria-3-clip-preview",
  "name": "Google: Lyria 3 Clip Preview",
  "provider": "google",
  "description": "30 second duration clips are priced at $0.04 per clip. Lyria 3 is Google's family of music generation models, available through the Gemini API. With Lyria 3, you can generate...",
  "context_length": 1048576,
  "max_output": 65536,
  "price_in": 0,
  "price_out": 0,
  "is_free": true,
  "supports_tools": false,
  "supports_images": true,
  "modality": "text+image->text+audio",
  "created_at_remote": 1774907255,
  "raw": {
   "supported_parameters": [
    "max_tokens",
    "response_format",
    "seed",
    "temperature",
    "top_p"
   ],
   "input_modalities": [
    "text",
    "image"
   ]
  }
 },
 {
  "id": "google/lyria-3-pro-preview",
  "name": "Google: Lyria 3 Pro Preview",
  "provider": "google",
  "description": "Full-length songs are priced at $0.08 per song. Lyria 3 is Google's family of music generation models, available through the Gemini API. With Lyria 3, you can generate high-quality, 48kHz...",
  "context_length": 1048576,
  "max_output": 65536,
  "price_in": 0,
  "price_out": 0,
  "is_free": true,
  "supports_tools": false,
  "supports_images": true,
  "modality": "text+image->text+audio",
  "created_at_remote": 1774907286,
  "raw": {
   "supported_parameters": [
    "max_tokens",
    "response_format",
    "seed",
    "temperature",
    "top_p"
   ],
   "input_modalities": [
    "text",
    "image"
   ]
  }
 },
 {
  "id": "inclusionai/ling-3.2-flash:free",
  "name": "inclusionAI: Ling 3.2 Flash (free)",
  "provider": "inclusionai",
  "description": "Ling 3.2 Flash is a hybrid reasoning model from inclusionAI that accepts text and image input, with a 1M-token context window and up to 200 images per request. Thinking can...",
  "context_length": 1048576,
  "max_output": 262144,
  "price_in": 0,
  "price_out": 0,
  "is_free": true,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image->text",
  "created_at_remote": 1794591958,
  "raw": {
   "supported_parameters": [
    "frequency_penalty",
    "include_reasoning",
    "max_tokens",
    "presence_penalty",
    "reasoning",
    "response_format",
    "seed",
    "stop",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools",
    "top_k",
    "top_p"
   ],
   "input_modalities": [
    "text",
    "image"
   ]
  }
 },
 {
  "id": "liquid/lfm-3-1.7b:free",
  "name": "LiquidAI: LFM3-1.7B (free)",
  "provider": "liquid",
  "description": "A compact 1.7B-parameter text model with a 256K-token context, post-trained for agents, tool calling, and structured outputs. It reasons before it answers. Prompts and outputs may be retained and used...",
  "context_length": 262144,
  "max_output": 8192,
  "price_in": 0,
  "price_out": 0,
  "is_free": true,
  "supports_tools": true,
  "supports_images": false,
  "modality": "text->text",
  "created_at_remote": 1794009477,
  "raw": {
   "supported_parameters": [
    "frequency_penalty",
    "include_reasoning",
    "logprobs",
    "max_completion_tokens",
    "max_tokens",
    "min_p",
    "presence_penalty",
    "reasoning",
    "repetition_penalty",
    "response_format",
    "seed",
    "stop",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools",
    "top_k",
    "top_logprobs",
    "top_p"
   ],
   "input_modalities": [
    "text"
   ]
  }
 },
 {
  "id": "meituan/longcat-2.0",
  "name": "Meituan: LongCat 2.0",
  "provider": "meituan",
  "description": "LongCat 2.0 is a sparse mixture-of-experts language model from Meituan, with 48B active parameters out of 1.6T total. It is suited for coding, repository-level changes, long-horizon problem solving, and agentic...",
  "context_length": 1048756,
  "max_output": 262144,
  "price_in": 0.3,
  "price_out": 1.2,
  "is_free": false,
  "supports_tools": true,
  "supports_images": false,
  "modality": "text->text",
  "created_at_remote": 1784554658,
  "raw": {
   "supported_parameters": [
    "frequency_penalty",
    "include_reasoning",
    "logit_bias",
    "max_tokens",
    "min_p",
    "presence_penalty",
    "reasoning",
    "repetition_penalty",
    "seed",
    "stop",
    "temperature",
    "tool_choice",
    "tools",
    "top_k",
    "top_p"
   ],
   "input_modalities": [
    "text"
   ]
  }
 },
 {
  "id": "meta-llama/llama-4-scout",
  "name": "Meta: Llama 4 Scout",
  "provider": "meta-llama",
  "description": "Llama 4 Scout 17B Instruct (16E) is a mixture-of-experts (MoE) language model developed by Meta, activating 17 billion parameters out of a total of 109B. It supports native multimodal input...",
  "context_length": 1310720,
  "max_output": 16384,
  "price_in": 0.1,
  "price_out": 0.3,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image->text",
  "created_at_remote": 1743881519,
  "raw": {
   "supported_parameters": [
    "frequency_penalty",
    "logit_bias",
    "max_tokens",
    "min_p",
    "presence_penalty",
    "repetition_penalty",
    "response_format",
    "seed",
    "stop",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools",
    "top_k",
    "top_p"
   ],
   "input_modalities": [
    "text",
    "image"
   ]
  }
 },
 {
  "id": "meta/muse-ember",
  "name": "Meta: Muse Ember",
  "provider": "meta",
  "description": "Muse Ember is the smallest and most efficient model from Meta that’s designed for complex reasoning execution and the work agents repeat all day: tool calls, coding agent subtasks, routing,...",
  "context_length": 1048576,
  "max_output": 943718,
  "price_in": 0.1,
  "price_out": 0.5,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+file+audio+video->text",
  "created_at_remote": 1794247648,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_tokens",
    "reasoning",
    "reasoning_effort",
    "repetition_penalty",
    "response_format",
    "seed",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools",
    "top_k",
    "top_p"
   ],
   "input_modalities": [
    "text",
    "image",
    "video",
    "file",
    "audio"
   ]
  }
 },
 {
  "id": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "name": "NVIDIA: Nemotron 3 Nano Omni (free)",
  "provider": "nvidia",
  "description": "NVIDIA Nemotron™ 3 Nano Omni is a 30B-A3B open multimodal model designed to function as a perception and context sub-agent in enterprise agent systems. It accepts text, image, video, and...",
  "context_length": 256000,
  "max_output": 65536,
  "price_in": 0,
  "price_out": 0,
  "is_free": true,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+audio+video->text",
  "created_at_remote": 1777393095,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_tokens",
    "reasoning",
    "seed",
    "temperature",
    "tool_choice",
    "tools",
    "top_p"
   ],
   "input_modalities": [
    "text",
    "audio",
    "image",
    "video"
   ]
  }
 },
 {
  "id": "nvidia/nemotron-3-ultra-550b-a55b:free",
  "name": "NVIDIA: Nemotron 3 Ultra (free)",
  "provider": "nvidia",
  "description": "NVIDIA Nemotron 3 Ultra is an open frontier-reasoning and orchestration model from NVIDIA, with 55B active parameters out of 550B total (MoE). Built on a hybrid Transformer-Mamba mixture-of-experts architecture, it...",
  "context_length": 1000000,
  "max_output": 65536,
  "price_in": 0,
  "price_out": 0,
  "is_free": true,
  "supports_tools": true,
  "supports_images": false,
  "modality": "text->text",
  "created_at_remote": 1780551208,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_tokens",
    "reasoning",
    "reasoning_effort",
    "seed",
    "temperature",
    "tool_choice",
    "tools",
    "top_p"
   ],
   "input_modalities": [
    "text"
   ]
  }
 },
 {
  "id": "nvidia/nemotron-3.5-lightning:free",
  "name": "NVIDIA: Nemotron 3.5 Lightning (free)",
  "provider": "nvidia",
  "description": "NVIDIA Nemotron 3.5 Lightning is an open mixture-of-experts model from NVIDIA, with 3B active parameters out of 30B total. It is suited for high-throughput agentic workloads and specialized tasks that...",
  "context_length": 1000000,
  "max_output": 65536,
  "price_in": 0,
  "price_out": 0,
  "is_free": true,
  "supports_tools": true,
  "supports_images": false,
  "modality": "text->text",
  "created_at_remote": 1786452751,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_tokens",
    "reasoning",
    "seed",
    "temperature",
    "tool_choice",
    "tools",
    "top_p"
   ],
   "input_modalities": [
    "text"
   ]
  }
 },
 {
  "id": "nvidia/nemotron-3.5-super-vl:free",
  "name": "NVIDIA: Nemotron 3.5 Super VL (free)",
  "provider": "nvidia",
  "description": "NVIDIA Nemotron 3.5 Super VL is an open multimodal mixture-of-experts model from NVIDIA, with 12B active parameters out of 120B total. It takes text, images, documents, GUI screenshots, and video...",
  "context_length": 1000000,
  "max_output": 131072,
  "price_in": 0,
  "price_out": 0,
  "is_free": true,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+video->text",
  "created_at_remote": 1792076662,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_tokens",
    "reasoning",
    "response_format",
    "seed",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools",
    "top_p"
   ],
   "input_modalities": [
    "text",
    "image",
    "video"
   ]
  }
 },
 {
  "id": "~openai/gpt-luna-latest",
  "name": "OpenAI: GPT Luna Latest",
  "provider": "~openai",
  "description": "This model always redirects to the latest model in the GPT Luna family.",
  "context_length": 1050000,
  "max_output": 128000,
  "price_in": 0.1,
  "price_out": 0.5,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+file->text",
  "created_at_remote": 1789130922,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_completion_tokens",
    "max_tokens",
    "reasoning",
    "reasoning_effort",
    "response_format",
    "seed",
    "structured_outputs",
    "tool_choice",
    "tools",
    "verbosity"
   ],
   "input_modalities": [
    "file",
    "image",
    "text"
   ]
  }
 },
 {
  "id": "openai/gpt-5.6-luna",
  "name": "OpenAI: GPT-5.6 Luna",
  "provider": "openai",
  "description": "GPT-5.6 Luna is a fast, cost-efficient model in OpenAI's GPT-5.6 series. It is suited for high-volume, latency-sensitive tasks such as chat, classification, and lightweight agentic workflows, providing capable reasoning for...",
  "context_length": 1050000,
  "max_output": 128000,
  "price_in": 0.2,
  "price_out": 1.2,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+file->text",
  "created_at_remote": 1783590864,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_completion_tokens",
    "max_tokens",
    "reasoning",
    "reasoning_effort",
    "response_format",
    "seed",
    "structured_outputs",
    "tool_choice",
    "tools",
    "verbosity"
   ],
   "input_modalities": [
    "file",
    "image",
    "text"
   ]
  }
 },
 {
  "id": "openai/gpt-5.6-luna:batch",
  "name": "OpenAI: GPT-5.6 Luna (batch)",
  "provider": "openai",
  "description": "GPT-5.6 Luna is a fast, cost-efficient model in OpenAI's GPT-5.6 series. It is suited for high-volume, latency-sensitive tasks such as chat, classification, and lightweight agentic workflows, providing capable reasoning for...",
  "context_length": 1050000,
  "max_output": 128000,
  "price_in": 0.1,
  "price_out": 0.6,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+file->text",
  "created_at_remote": 1783590864,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_tokens",
    "reasoning",
    "reasoning_effort",
    "response_format",
    "seed",
    "structured_outputs",
    "tool_choice",
    "tools",
    "verbosity"
   ],
   "input_modalities": [
    "file",
    "image",
    "text"
   ]
  }
 },
 {
  "id": "openai/gpt-5.6-luna-pro",
  "name": "OpenAI: GPT-5.6 Luna Pro",
  "provider": "openai",
  "description": "GPT-5.6 Luna Pro is the same underlying model as [GPT-5.6 Luna](https://openrouter.ai/openai/gpt-5.6-luna), served with `reasoning.mode` set to `pro` for higher-quality responses on complex tasks. **Cost note:** pro mode spends far more...",
  "context_length": 1050000,
  "max_output": 128000,
  "price_in": 0.2,
  "price_out": 1.2,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+file->text",
  "created_at_remote": 1783590867,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_completion_tokens",
    "max_tokens",
    "reasoning",
    "reasoning_effort",
    "response_format",
    "seed",
    "structured_outputs",
    "tool_choice",
    "tools",
    "verbosity"
   ],
   "input_modalities": [
    "file",
    "image",
    "text"
   ]
  }
 },
 {
  "id": "openai/gpt-5.6-luna-pro:batch",
  "name": "OpenAI: GPT-5.6 Luna Pro (batch)",
  "provider": "openai",
  "description": "GPT-5.6 Luna Pro is the same underlying model as [GPT-5.6 Luna](https://openrouter.ai/openai/gpt-5.6-luna), served with `reasoning.mode` set to `pro` for higher-quality responses on complex tasks. **Cost note:** pro mode spends far more...",
  "context_length": 1050000,
  "max_output": 128000,
  "price_in": 0.1,
  "price_out": 0.6,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+file->text",
  "created_at_remote": 1783590867,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_tokens",
    "reasoning",
    "reasoning_effort",
    "response_format",
    "seed",
    "structured_outputs",
    "tool_choice",
    "tools",
    "verbosity"
   ],
   "input_modalities": [
    "file",
    "image",
    "text"
   ]
  }
 },
 {
  "id": "openai/gpt-6-luna",
  "name": "OpenAI: GPT-6 Luna",
  "provider": "openai",
  "description": "GPT-6 Luna is the fast, cost-efficient model in OpenAI's GPT-6 series, positioned below GPT-6 Sol. It is suited for high-volume and latency-sensitive workloads such as chat, classification, and lightweight agentic...",
  "context_length": 1050000,
  "max_output": 128000,
  "price_in": 0.1,
  "price_out": 0.5,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+file->text",
  "created_at_remote": 1790100786,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_completion_tokens",
    "max_tokens",
    "reasoning",
    "reasoning_effort",
    "response_format",
    "seed",
    "structured_outputs",
    "tool_choice",
    "tools",
    "verbosity"
   ],
   "input_modalities": [
    "file",
    "image",
    "text"
   ]
  }
 },
 {
  "id": "openai/gpt-6-luna:batch",
  "name": "OpenAI: GPT-6 Luna (batch)",
  "provider": "openai",
  "description": "GPT-6 Luna is the fast, cost-efficient model in OpenAI's GPT-6 series, positioned below GPT-6 Sol. It is suited for high-volume and latency-sensitive workloads such as chat, classification, and lightweight agentic...",
  "context_length": 1050000,
  "max_output": 128000,
  "price_in": 0.05,
  "price_out": 0.25,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+file->text",
  "created_at_remote": 1790100786,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_tokens",
    "reasoning",
    "reasoning_effort",
    "response_format",
    "seed",
    "structured_outputs",
    "tool_choice",
    "tools",
    "verbosity"
   ],
   "input_modalities": [
    "file",
    "image",
    "text"
   ]
  }
 },
 {
  "id": "openai/gpt-6-luna-pro",
  "name": "OpenAI: GPT-6 Luna Pro",
  "provider": "openai",
  "description": "GPT-6 Luna Pro is the same underlying model as [GPT-6 Luna](https://openrouter.ai/openai/gpt-6-luna), served with `reasoning.mode` set to `pro` for higher-quality responses on complex tasks. **Cost note:** pro mode spends far more...",
  "context_length": 1050000,
  "max_output": 128000,
  "price_in": 0.1,
  "price_out": 0.5,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+file->text",
  "created_at_remote": 1790100791,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_completion_tokens",
    "max_tokens",
    "reasoning",
    "reasoning_effort",
    "response_format",
    "seed",
    "structured_outputs",
    "tool_choice",
    "tools",
    "verbosity"
   ],
   "input_modalities": [
    "file",
    "image",
    "text"
   ]
  }
 },
 {
  "id": "openai/gpt-6-luna-pro:batch",
  "name": "OpenAI: GPT-6 Luna Pro (batch)",
  "provider": "openai",
  "description": "GPT-6 Luna Pro is the same underlying model as [GPT-6 Luna](https://openrouter.ai/openai/gpt-6-luna), served with `reasoning.mode` set to `pro` for higher-quality responses on complex tasks. **Cost note:** pro mode spends far more...",
  "context_length": 1050000,
  "max_output": 128000,
  "price_in": 0.05,
  "price_out": 0.25,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+file->text",
  "created_at_remote": 1790100791,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_tokens",
    "reasoning",
    "reasoning_effort",
    "response_format",
    "seed",
    "structured_outputs",
    "tool_choice",
    "tools",
    "verbosity"
   ],
   "input_modalities": [
    "file",
    "image",
    "text"
   ]
  }
 },
 {
  "id": "openai/gpt-6.1-terra:batch",
  "name": "OpenAI: GPT-6.1 Terra (batch)",
  "provider": "openai",
  "description": "GPT-6.1 Terra is the mid-tier model in OpenAI's GPT-6.1 series, priced below GPT-6.1 Sol. It is suited for everyday agentic, coding, and writing work, is particularly strong at understanding screenshots...",
  "context_length": 1050000,
  "max_output": 128000,
  "price_in": 0.5,
  "price_out": 2.5,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+file->text",
  "created_at_remote": 1793038409,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_tokens",
    "reasoning",
    "reasoning_effort",
    "response_format",
    "seed",
    "structured_outputs",
    "tool_choice",
    "tools",
    "verbosity"
   ],
   "input_modalities": [
    "file",
    "image",
    "text"
   ]
  }
 },
 {
  "id": "openai/gpt-6.1-terra-pro:batch",
  "name": "OpenAI: GPT-6.1 Terra Pro (batch)",
  "provider": "openai",
  "description": "GPT-6.1 Terra Pro is the same underlying model as [GPT-6.1 Terra](https://openrouter.ai/openai/gpt-6.1-terra), served with `reasoning.mode` set to `pro` for higher-quality responses on complex tasks. **Cost note:** pro mode spends far more...",
  "context_length": 1050000,
  "max_output": 128000,
  "price_in": 0.5,
  "price_out": 2.5,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+file->text",
  "created_at_remote": 1793038556,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_tokens",
    "reasoning",
    "reasoning_effort",
    "response_format",
    "seed",
    "structured_outputs",
    "tool_choice",
    "tools",
    "verbosity"
   ],
   "input_modalities": [
    "file",
    "image",
    "text"
   ]
  }
 },
 {
  "id": "openrouter/pareto-code",
  "name": "Pareto Code Router",
  "provider": "openrouter",
  "description": "The Pareto Router maintains a tiered shortlist of strong coding models, ranked by [Artificial Analysis](https://artificialanalysis.ai/) coding percentiles. Set min_coding_score between 0 and 1 on the [pareto-router plugin](https://openrouter.ai/docs/guides/routing/routers/pareto-",
  "context_length": 2000000,
  "max_output": 0,
  "price_in": -1000000,
  "price_out": -1000000,
  "is_free": false,
  "supports_tools": true,
  "supports_images": false,
  "modality": "text->text",
  "created_at_remote": 1776747900,
  "raw": {
   "supported_parameters": [
    "frequency_penalty",
    "include_reasoning",
    "logit_bias",
    "logprobs",
    "max_completion_tokens",
    "max_tokens",
    "min_p",
    "parallel_tool_calls",
    "presence_penalty",
    "reasoning",
    "reasoning_effort",
    "repetition_penalty",
    "response_format",
    "seed",
    "stop",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools",
    "top_a",
    "top_k",
    "top_logprobs",
    "top_p",
    "verbosity"
   ],
   "input_modalities": [
    "text"
   ]
  }
 },
 {
  "id": "particle-ai/particle-1",
  "name": "Particle AI: Particle-1",
  "provider": "particle-ai",
  "description": "Particle-1 is a token-efficient agentic coding model from Particle AI, post-trained on DeepSeek V4.1 Flash. It is suited for software engineering work such as terminal workflows, codebase changes, and data...",
  "context_length": 1048576,
  "max_output": 131072,
  "price_in": 0.06,
  "price_out": 0.5,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image->text",
  "created_at_remote": 1793207893,
  "raw": {
   "supported_parameters": [
    "frequency_penalty",
    "include_reasoning",
    "logprobs",
    "max_tokens",
    "min_p",
    "presence_penalty",
    "reasoning",
    "reasoning_effort",
    "repetition_penalty",
    "response_format",
    "seed",
    "stop",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools",
    "top_k",
    "top_logprobs",
    "top_p"
   ],
   "input_modalities": [
    "text",
    "image"
   ]
  }
 },
 {
  "id": "particle-ai/particle-1:free",
  "name": "Particle AI: Particle-1 (free)",
  "provider": "particle-ai",
  "description": "Particle-1 is a token-efficient agentic coding model from Particle AI, post-trained on DeepSeek V4.1 Flash. It is suited for software engineering work such as terminal workflows, codebase changes, and data...",
  "context_length": 1048576,
  "max_output": 131072,
  "price_in": 0,
  "price_out": 0,
  "is_free": true,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image->text",
  "created_at_remote": 1793207893,
  "raw": {
   "supported_parameters": [
    "frequency_penalty",
    "include_reasoning",
    "logprobs",
    "max_tokens",
    "min_p",
    "presence_penalty",
    "reasoning",
    "reasoning_effort",
    "repetition_penalty",
    "response_format",
    "seed",
    "stop",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools",
    "top_k",
    "top_logprobs",
    "top_p"
   ],
   "input_modalities": [
    "text",
    "image"
   ]
  }
 },
 {
  "id": "recursive/flint-v1.0:free",
  "name": "Recursive: Flint (free)",
  "provider": "recursive",
  "description": "Flint is an open-weight mixture-of-experts model from Recursive, with about 2.5B active parameters out of 40B total, built by Recursive's autoresearch system Eureka Machine for coding agents. It is suited...",
  "context_length": 262144,
  "max_output": 235929,
  "price_in": 0,
  "price_out": 0,
  "is_free": true,
  "supports_tools": true,
  "supports_images": false,
  "modality": "text->text",
  "created_at_remote": 1792622765,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "logprobs",
    "max_tokens",
    "reasoning",
    "response_format",
    "seed",
    "stop",
    "temperature",
    "tools",
    "top_logprobs",
    "top_p"
   ],
   "input_modalities": [
    "text"
   ]
  }
 },
 {
  "id": "ricursiveai/ripple-65b-preview",
  "name": "Ricursive: Ripple 65B Preview",
  "provider": "ricursiveai",
  "description": "Ripple-65B-Preview by ricursiveAI, a 65B model with native tool calling, served in BF16.",
  "context_length": 1048576,
  "max_output": 131072,
  "price_in": 0.1,
  "price_out": 0.3,
  "is_free": false,
  "supports_tools": true,
  "supports_images": false,
  "modality": "text->text",
  "created_at_remote": 1793818990,
  "raw": {
   "supported_parameters": [
    "frequency_penalty",
    "include_reasoning",
    "logit_bias",
    "logprobs",
    "max_tokens",
    "min_p",
    "presence_penalty",
    "reasoning",
    "repetition_penalty",
    "response_format",
    "seed",
    "stop",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools",
    "top_k",
    "top_logprobs",
    "top_p"
   ],
   "input_modalities": [
    "text"
   ]
  }
 },
 {
  "id": "tencent/hy4",
  "name": "Tencent: Hy4",
  "provider": "tencent",
  "description": "The official release of Hy4 delivers comprehensive and substantial improvements over Hy4 Preview, with particularly strong gains in agentic capabilities and performance across a wide range of long-horizon, real-world productivity...",
  "context_length": 1048576,
  "max_output": 65536,
  "price_in": 0.417,
  "price_out": 1.2505,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image->text",
  "created_at_remote": 1793766031,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_completion_tokens",
    "max_tokens",
    "reasoning",
    "reasoning_effort",
    "response_format",
    "stop",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools"
   ],
   "input_modalities": [
    "text",
    "image"
   ]
  }
 },
 {
  "id": "tencent/hy4-flash",
  "name": "Tencent: Hy4 flash",
  "provider": "tencent",
  "description": "Hy4 flash is a cost-efficient variant of [Hy4](https://openrouter.ai/tencent/hy4) from Tencent, served with roughly a quarter of the flagship's parameter count for lower latency and cost. It targets code assistance, agent...",
  "context_length": 1048576,
  "max_output": 65536,
  "price_in": 0.035,
  "price_out": 0.1405,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image->text",
  "created_at_remote": 1794838706,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_completion_tokens",
    "max_tokens",
    "reasoning",
    "response_format",
    "stop",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools"
   ],
   "input_modalities": [
    "text",
    "image"
   ]
  }
 },
 {
  "id": "thinkingmachines/inkling-2-small",
  "name": "Thinking Machines: Inkling 2 Small",
  "provider": "thinkingmachines",
  "description": "Inkling 2 Small is an open-weight multimodal mixture-of-experts reasoning model from Thinking Machines Lab, with 17B active parameters out of 594B total. It is the first model in the second...",
  "context_length": 1048576,
  "max_output": 943718,
  "price_in": 0.3,
  "price_out": 1,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image->text",
  "created_at_remote": 1794261847,
  "raw": {
   "supported_parameters": [
    "frequency_penalty",
    "include_reasoning",
    "logit_bias",
    "logprobs",
    "max_tokens",
    "min_p",
    "presence_penalty",
    "reasoning",
    "reasoning_effort",
    "repetition_penalty",
    "response_format",
    "seed",
    "stop",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools",
    "top_k",
    "top_logprobs",
    "top_p"
   ],
   "input_modalities": [
    "text",
    "image"
   ]
  }
 },
 {
  "id": "thinkingmachines/inkling-2-small:free",
  "name": "Thinking Machines: Inkling 2 Small (free)",
  "provider": "thinkingmachines",
  "description": "Inkling 2 Small is an open-weight multimodal mixture-of-experts reasoning model from Thinking Machines Lab, with 17B active parameters out of 594B total. It is the first model in the second...",
  "context_length": 1048576,
  "max_output": 131072,
  "price_in": 0,
  "price_out": 0,
  "is_free": true,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image->text",
  "created_at_remote": 1794261847,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_tokens",
    "reasoning",
    "reasoning_effort",
    "seed",
    "stop",
    "temperature",
    "tools",
    "top_p"
   ],
   "input_modalities": [
    "text",
    "image"
   ]
  }
 },
 {
  "id": "xiaomi/mimo-v2.6-flash",
  "name": "Xiaomi: MiMo-V2.6-Flash",
  "provider": "xiaomi",
  "description": "MiMo-V2.6-Flash is an open-source foundation model developed by Xiaomi. Built on a Mixture-of-Experts architecture with 309B total parameters and 15B activated per token, it employs a hybrid attention mechanism for...",
  "context_length": 1050000,
  "max_output": 131072,
  "price_in": 0.14,
  "price_out": 0.28,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+audio+video->text",
  "created_at_remote": 1790021264,
  "raw": {
   "supported_parameters": [
    "frequency_penalty",
    "include_reasoning",
    "logit_bias",
    "logprobs",
    "max_tokens",
    "min_p",
    "parallel_tool_calls",
    "presence_penalty",
    "reasoning",
    "repetition_penalty",
    "response_format",
    "seed",
    "stop",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools",
    "top_k",
    "top_logprobs",
    "top_p"
   ],
   "input_modalities": [
    "text",
    "image",
    "video",
    "audio"
   ]
  }
 },
 {
  "id": "xiaomi/mimo-v2.6-pro",
  "name": "Xiaomi: MiMo-V2.6-Pro",
  "provider": "xiaomi",
  "description": "MiMo-V2.6-Pro is the flagship foundation model developed by Xiaomi. Built at a scale of over 1T parameters, it is designed to push the ceiling of capability for the most demanding...",
  "context_length": 1050000,
  "max_output": 131072,
  "price_in": 0.435,
  "price_out": 0.87,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+audio+video->text",
  "created_at_remote": 1790021259,
  "raw": {
   "supported_parameters": [
    "frequency_penalty",
    "include_reasoning",
    "logit_bias",
    "logprobs",
    "max_tokens",
    "min_p",
    "presence_penalty",
    "reasoning",
    "repetition_penalty",
    "response_format",
    "seed",
    "stop",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools",
    "top_k",
    "top_logprobs",
    "top_p"
   ],
   "input_modalities": [
    "text",
    "image",
    "video",
    "audio"
   ]
  }
 },
 {
  "id": "z-ai/glm-5.3-flashx-legal",
  "name": "Z.ai: GLM 5.3 FlashX Legal",
  "provider": "z-ai",
  "description": "GLM-5.3-FlashX-Legal (GLM-Legal) is Z.ai's legal-domain variant of GLM-5.3-FlashX, a native multimodal model that accepts text, image, and video input and produces text. It adds legal-domain mid-training and post-training with reinforcement...",
  "context_length": 1048576,
  "max_output": 131072,
  "price_in": 0.37,
  "price_out": 1.25,
  "is_free": false,
  "supports_tools": true,
  "supports_images": true,
  "modality": "text+image+video->text",
  "created_at_remote": 1793626154,
  "raw": {
   "supported_parameters": [
    "include_reasoning",
    "max_tokens",
    "reasoning",
    "reasoning_effort",
    "response_format",
    "structured_outputs",
    "temperature",
    "tool_choice",
    "tools",
    "top_k",
    "top_p"
   ],
   "input_modalities": [
    "text",
    "image",
    "video"
   ]
  }
 }
];
