import { API_CONFIG } from '@/constants/config';
import { authenticatedFetch } from '@/services/authenticatedFetch';

export interface BlueprintAnalysisResponse {
  code: number;
  message: string;
  result: {
    is_blueprint: boolean;
    components: any[];
    confidence: string;
    quality_issues: string[];
    model_params_list: any[];
    task_id?: string;
    elapsed_seconds?: number;
  } | null;
}

export async function analyzeBlueprint(
  imageBase64: string,
  preprocessEnabled: boolean = true
): Promise<BlueprintAnalysisResponse> {
  const apiUrl = `${API_CONFIG.BASE_URL}/api/blueprint/analyze`;

  const formData = new FormData();
  formData.append('image_base64', imageBase64);
  formData.append('image_format', 'jpeg');
  formData.append('preprocess_enabled', String(preprocessEnabled));

  const response = await authenticatedFetch(apiUrl, {
    method: 'POST',
    body: formData,
  });

  return response.json();
}

export async function getComponent(componentId: string): Promise<any> {
  const apiUrl = `${API_CONFIG.BASE_URL}/api/blueprint/components/${componentId}`;
  const response = await authenticatedFetch(apiUrl);
  return response.json();
}

export async function getBlueprintHealth(): Promise<any> {
  const apiUrl = `${API_CONFIG.BASE_URL}/api/blueprint/health`;
  const response = await authenticatedFetch(apiUrl);
  return response.json();
}
