export interface beError {
  response?: {
    status: number;
    data?: {
      error?: string;
      message?: string;
      conflicts?: { message: string }[];
      validationErrors?: any;
      details?: any;
    };
  };
  message?: string;
}

export class beErrorHandler {
  static getErrorMessage(error: beError): string {
    const status = error.response?.status;
    const data = error.response?.data;

    if (!status) {
      return 'Failed to connect to server. Please check your internet connection and try again.';
    }

    // 422: Programme combination invalid
    if (status === 422) {
      const conflictMessages = data?.conflicts?.map(c => c.message).join('. ') || 'The selected combination is not allowed.';
      return `Invalid Programme Combination: ${conflictMessages} Please select a different combination.`;
    }

    // 500: Internal backend validation or populator failure
    if (status === 500) {
      return 'A server error occurred. Please try again later or contact support.';
    }

    // 400: Invalid request structure
    if (status === 400 && data?.error === 'INVALID_REQUEST') {
      return `Invalid Request: ${data.message || 'Please check your programme selection and try again.'}`;
    }

    if (status === 400 && data?.error === 'TOO_MANY_PROGRAMMES') {
      return `You have selected too many programmes (max 5 allowed).`;
    }

    // Unknown fallback
    return 'An unexpected error occurred. Please try again later.';
  }
}
