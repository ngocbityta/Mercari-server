export enum ResponseCode {
    OK = '1000',
    POST_NOT_FOUND = '9992',
    CODE_VERIFY_INCORRECT = '9993',
    NO_DATA = '9994',
    USER_NOT_VALIDATED = '9995',
    USER_EXISTED = '9996',
    METHOD_INVALID = '9997',
    TOKEN_INVALID = '9998',
    EXCEPTION_ERROR = '9999',
    INVALID_PARAMETER_TYPE = '1003',
    INVALID_PARAMETER_VALUE = '1004',
    ACCOUNT_LOCKED = '9991',
}

export const ResponseMessage: Record<string, string> = {
    [ResponseCode.OK]: 'OK',
    [ResponseCode.POST_NOT_FOUND]: 'Post is not existed',
    [ResponseCode.CODE_VERIFY_INCORRECT]: 'Code verify is incorrect',
    [ResponseCode.NO_DATA]: 'No data or end of list data',
    [ResponseCode.USER_NOT_VALIDATED]: 'User is not validated',
    [ResponseCode.USER_EXISTED]: 'User existed',
    [ResponseCode.METHOD_INVALID]: 'Method is invalid',
    [ResponseCode.TOKEN_INVALID]: 'Token is invalid',
    [ResponseCode.EXCEPTION_ERROR]: 'Exception error',
    [ResponseCode.INVALID_PARAMETER_TYPE]: 'Parameter type is invalid',
    [ResponseCode.INVALID_PARAMETER_VALUE]: 'Parameter value is invalid',
    [ResponseCode.ACCOUNT_LOCKED]: 'Account is locked',
};
