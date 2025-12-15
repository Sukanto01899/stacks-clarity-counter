(define-data-var counter uint u0)
(define-data-var contract-admin principal tx-sender)
(define-data-var cost uint u10)

(define-ready-only (get-counter) 
(var-get counter)
)

(define-public (add) 
  (begin (print u"Add number")
  (ok (var-set counter(+ (var-get counter) u1)))
  )
)