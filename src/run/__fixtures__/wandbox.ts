export const WANDBOX_SUCCESS = {
  status: '0', signal: '', compiler_error: '',
  program_output: 'Hi Aman\n', program_error: 'on stderr\n',
  permlink: '', url: '',
}

export const WANDBOX_COMPILE_ERROR = {
  status: '1', signal: '',
  compiler_error:
    'prog.java:1: error: incompatible types: String cannot be converted to int\n1 error\n',
  program_output: '', program_error: '', permlink: '', url: '',
}

export const WANDBOX_RUNTIME_ERROR = {
  status: '1', signal: '', compiler_error: '', program_output: '',
  program_error:
    'Exception in thread "main" java.lang.ArrayIndexOutOfBoundsException: ' +
    'Index 5 out of bounds for length 1\n\tat Main.main(prog.java:1)\n',
  permlink: '', url: '',
}
