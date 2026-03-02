package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "entrances")
public class EntranceEntity extends BaseEntity {

    @Column(name = "block_id", nullable = false)
    private String blockId;

    @Column(name = "number", nullable = false)
    private Integer number;
}