#----------------------------------------------------------------------------------------------
#  Copyright (c) Lennart C. L. Kats.
#  Licensed under the MIT License. See License.txt in the project root for license information.
#----------------------------------------------------------------------------------------------
#
# null-delimited polyfill for ls
#
ls() {
    shopt -s nullglob
    local ARG
    local OPTION_D
    local OPTION_A

    for ARG in "$@"; do
        case $ARG in
            -d) OPTION_D=1; shift ;;
            -A) OPTION_A=1; shift ;;
            -dA|-Ad) OPTION_A=1; OPTION_D=1; shift ;;
            --) shift ;;
            -*)
                echo -n "Warning: parsing stanard 'ls' in sh.vals() is unsafe per https://mywiki.wooledge.org/ParsingLs." >&4
                echo -n "shellsync has a built-in ls polyfill that safe to use:" >&4
                echo -n "usage: ls [-Ad] [--] [file ...]" >&4
                command ls "$@"
                return ;;
            *) break ;; # end option parsing
        esac
    done

    print() {
        if [[ $1 = -e || "$1" = -n ]]; then
            printf "$1\0"
        else
            echo -n "$1"; printf "\0"
        fi
    }
    simple_ls() {
        local FILE
        if [[ $OPTION_A ]]; then
            for FILE in * .*; do
                if [[ $FILE != . && $FILE != .. ]]; then
                    print "$FILE"
                fi
            done
        else
            for FILE in *; do
                print "$FILE"
            done
        fi
    }

    if [[ ! $@ ]]; then
        simple_ls
        return
    fi

    local RESULT=0
    for ARG in $*; do
        if [[ -d $ARG && ! $OPTION_D ]]; then
            cd $ARG
            simple_ls
            cd ..
        elif [[ -e $ARG ]]; then
            print "$ARG"
        else        
            echo "ls: $ARG: No such file or directory" >&2
            RESULT=1
        fi
    done
    return $RESULT
}